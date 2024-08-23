import fs from "node:fs";
import path from "node:path/posix";
import { spawn } from "node:child_process";
import { builtinModules, createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { generate } from "astring";
import { transform as sucraseTransform } from "sucrase";
import { getTsconfig, createPathsMatcher } from "get-tsconfig";
import { resolve as importResolve } from "import-meta-resolve";
import { parse } from "espree";
import process from "node:process";

const require = createRequire(import.meta.url);

const parseModule = (a: Parameters<typeof parse>[0], b?: Parameters<typeof parse>[1]) => {
  return parse(a, { ...b, sourceType: "module", ecmaVersion: "latest" });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;
type AST = ReturnType<typeof parseModule>;
type ResolveData = {
  baseUrl: string | null;
  dirname: string;
  configPath: string | null;
  matcher: ((specifier: string) => string[]) | null;
  paths: Record<string, Array<string>>;
  ext: string;
};

export type FileResult = {
  rawInputFile: string;
  inputFile: string;
  outputFormat: ".cjs" | ".mjs";
  outputFilePath: string;
  dependencyMap: Map<string, string>;
};

/**
 * Convert an input code string to a node-friendly esm code string
 */
export const transform = async (inputCode: string, filePath?: string): Promise<string> => {
  let { code } = sucraseTransform(inputCode, {
    transforms: ["typescript", ...((filePath ?? ".ts").endsWith(".ts") ? [] : ["jsx" as const])],
    jsxPragma: "React.createClass",
    jsxFragmentPragma: "React.Fragment",
    enableLegacyTypeScriptModuleInterop: false,
    enableLegacyBabel5ModuleInterop: false,
    filePath,
    production: false,
  });
  if (code.startsWith("#!")) {
    code = code.slice(code.indexOf("\n") + 1);
  }
  return code;
};

export type BuildResult = {
  entrypoint: string;
  files: FileResult[];
};

/**
 * Convert source code from an entry file into a directory of node-friendly esm code
 */
export const build = async (
  entryFilePath: string,
  outputDirectory: string
): Promise<BuildResult> => {
  /* istanbul ignore next */
  if (process.platform === "win32") {
    throw new Error("xnr does not currently support windows");
  }

  outputDirectory = path.resolve(outputDirectory);

  const astCache = new Map<string, AST>();

  const fsCache = new Map<string, Set<string>>();
  const checkFile = (filePath: string): boolean => {
    const parentDirectory = path.join(filePath, "..");
    const name = filePath.slice(parentDirectory.length + 1);
    let filesSet = fsCache.get(parentDirectory);
    if (!filesSet) {
      filesSet = new Set<string>();
      try {
        for (const dirent of fs.readdirSync(parentDirectory, { withFileTypes: true })) {
          if (dirent.isFile()) {
            filesSet.add(dirent.name);
          }
        }
        fsCache.set(parentDirectory, filesSet);
      } catch {}
    }
    return filesSet.has(name);
  };

  const firstFilePath = path.resolve(process.cwd(), entryFilePath);
  const fileStack: {
    filePath: string;
    parentFilePath: string;
    rawImportPath: string;
    entryMethod: "entry" | "import" | "require";
  }[] = [
    {
      filePath: firstFilePath,
      parentFilePath: path.extname(firstFilePath),
      rawImportPath: entryFilePath,
      entryMethod: "entry",
    },
  ];
  const explored = new Set();
  const internalSourceFiles: Array<Omit<FileResult, "outputFilePath">> = [];
  while (fileStack.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { filePath, parentFilePath, rawImportPath, entryMethod } = fileStack.pop()!;
    if (!explored.has(filePath)) {
      explored.add(filePath);
      const actualFilePath = resolveLocalImport({
        absImportPath: filePath,
        importedFrom: parentFilePath,
        rawImportPath,
        type: entryMethod === "require" ? "require" : "import",
        checkFile,
      });

      const actualFileString = await fs.promises.readFile(actualFilePath, "utf8");

      // special case if the file is json
      if (path.extname(actualFilePath).toLowerCase().startsWith(".json")) {
        const outputFormat = entryMethod === "require" ? ".cjs" : ".mjs";
        // use sucrase to turn it into output string, store for later
        const code = await transform(
          (outputFormat === ".mjs" ? "export default " : "module.exports = ") + actualFileString,
          actualFilePath
        );
        // parse into an ast. cache for later key by filepath
        const ast: AST = parseModule(code);
        astCache.set(filePath, ast);
        internalSourceFiles.push({
          rawInputFile: filePath,
          inputFile: actualFilePath,
          outputFormat,
          dependencyMap: new Map<string, string>(),
        });
      } else {
        // use sucrase to turn it into output string, store for later
        const code = await transform(actualFileString, actualFilePath);
        // parse into an ast. cache for later key by filepath
        const ast: AST = parseModule(code);
        astCache.set(filePath, ast);
        // find config file if hasn't already found one for this dir
        const pathResolvers = getResolveData(filePath);
        // read file for imports/exports/requires
        const dependenciesData = await readForDependencies(
          ast,
          pathResolvers,
          actualFilePath,
          checkFile
        );
        const dependencies = dependenciesData.filter(([dependency]) => {
          return !isNodeBuiltin(dependency);
        });
        // filter to internal dependencies
        const dependencyMap = new Map(
          dependencies.map(([resolved, , original]) => {
            return [original, resolved];
          })
        );
        for (const [dependency, entryMethod] of dependencies) {
          if (dependency.startsWith(".") || dependency.startsWith("/")) {
            const nextFilePath = path.resolve(actualFilePath, "..", dependency);

            fileStack.push({
              filePath: nextFilePath,
              parentFilePath: filePath,
              rawImportPath: dependency,
              entryMethod,
            });
          }
        }
        internalSourceFiles.push({
          rawInputFile: filePath,
          inputFile: actualFilePath,
          outputFormat: await determineModuleTypeFromAST(ast),
          dependencyMap,
        });
      }
    }
  }

  // Find common root directory of all source files
  let commonRootPath = firstFilePath;
  while (commonRootPath !== "/") {
    commonRootPath = path.join(commonRootPath, "..");
    const ensureSlash = commonRootPath + "/";
    const areAllFilePathsDescendants = internalSourceFiles.every(({ inputFile }) => {
      return inputFile.startsWith(ensureSlash);
    });
    if (areAllFilePathsDescendants) break;
  }

  await fs.promises.rm(outputDirectory, { recursive: true, force: true });
  await fs.promises.mkdir(outputDirectory, { recursive: true });

  let outputEntryFilePath = "";

  const internalSourceFilesMap = new Map<string, FileResult>(
    internalSourceFiles.map(({ rawInputFile, inputFile, outputFormat, dependencyMap }) => {
      let outputPath = outputDirectory + "/" + inputFile.slice(commonRootPath.length + 1);
      outputPath =
        outputPath.slice(0, outputPath.length - path.extname(outputPath).length) + outputFormat;
      const outputFilePath = path.resolve(outputDirectory, outputPath);
      if (outputEntryFilePath === "") {
        outputEntryFilePath = outputFilePath;
      }

      return [
        path.relative(
          outputDirectory,
          outputFilePath.slice(0, outputFilePath.length - path.extname(outputFilePath).length)
        ),
        { rawInputFile, inputFile, outputFormat, outputFilePath, dependencyMap },
      ];
    })
  );

  const files = [...internalSourceFilesMap.values()];

  await Promise.all(
    files.map(async ({ rawInputFile, inputFile, outputFilePath, dependencyMap }) => {
      const newFile = await transformAST(
        rawInputFile,
        astCache.get(rawInputFile) as AST,
        outputDirectory,
        path.relative(commonRootPath, inputFile),
        internalSourceFilesMap,
        dependencyMap,
        inputFile
      );

      /* Enable require from esm */
      await fs.promises.mkdir(path.join(outputFilePath, ".."), { recursive: true });
      await fs.promises.writeFile(outputFilePath, "#!/usr/bin/env node\n" + newFile);
    })
  );

  return { entrypoint: outputEntryFilePath, files };
};

/**
 * Runs a file, no questions asked (auto-transpiling it and its dependencies as required)
 */
export const run = async (
  entryFilePath: string,
  args: string[] = [],
  nodeArgs: string[] = [],
  outputDirectory_?: string | undefined,
  writeStdout: (message: string) => void = process.stdout.write.bind(process.stdout),
  writeStderr: (message: string) => void = process.stderr.write.bind(process.stderr)
): Promise<number> => {
  /* istanbul ignore next */
  if (process.platform === "win32") {
    throw new Error("xnr does not currently support windows");
  }

  let outputDirectory: string;
  if (outputDirectory_) {
    outputDirectory = path.resolve(outputDirectory_);
  } else {
    let current = path.resolve(entryFilePath);
    let packageJsonPath: string | undefined;
    while (current !== "/") {
      const packageJsonPath_ = path.join(current, "package.json");
      if (fs.existsSync(packageJsonPath_)) {
        packageJsonPath = packageJsonPath_;
        break;
      }
      current = path.join(current, "..");
    }
    outputDirectory = packageJsonPath
      ? path.join(packageJsonPath, "../node_modules/.cache/xnr")
      : path.join(process.cwd(), ".tmp/xnr");
  }

  const cleanupSync = () => {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  };

  return new Promise<number>((resolve) => {
    (async () => {
      try {
        const { entrypoint, files } = await build(entryFilePath, outputDirectory);

        const outputDirectoryErrorLocationRegex = new RegExp(
          `(${outputDirectory.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&")}/[^:\n]*)(?::\\d+){0,2}`,
          "g"
        );

        const outputToInputFileLookup = new Map<string, string>();
        for (const { inputFile, outputFilePath } of files) {
          outputToInputFileLookup.set(outputFilePath, inputFile);
        }

        const randomBytes = "&nT@r" + "9F2Td";

        const transformErrors = (str: string) => {
          if (str.includes(outputDirectory)) {
            // Replaces output file paths with input file paths
            for (const match of [...str.matchAll(outputDirectoryErrorLocationRegex)].reverse()) {
              const file = match[1];
              const inputFile = outputToInputFileLookup.get(file);
              if (inputFile) {
                const nextPartStartIndex = (match.index as number) + match[0].length;
                str = `${str.slice(0, match.index ?? 0)}${inputFile}${randomBytes}${str.slice(
                  nextPartStartIndex
                )}`;
              }
            }

            // Removes the parts of the stack trace that are constant to all xnr runs
            const inLines = str.split("\n");
            const outLines = [];

            let hasFoundFirstSourceFile = false;
            for (let i = inLines.length - 1; i >= 0; i--) {
              const inLine = inLines[i];
              if (hasFoundFirstSourceFile) {
                outLines.push(inLine);
              } else {
                if (inLine.startsWith("    at ")) {
                  if (inLine.includes(randomBytes)) {
                    hasFoundFirstSourceFile = true;
                    outLines.push(inLine);
                  }
                } else {
                  outLines.push(inLine);
                }
              }
            }
            str = outLines.reverse().join("\n").replaceAll(randomBytes, "");
          }

          return str;
        };

        process.on("SIGINT", cleanupSync); // CTRL+C
        process.on("SIGQUIT", cleanupSync); // Keyboard quit
        process.on("SIGTERM", cleanupSync); // `kill` command
        const child = spawn("node", [...nodeArgs, entrypoint, ...args], {
          stdio: [
            // stdin
            "inherit",
            // stdout
            "pipe",
            // stderr
            "pipe",
          ],
        });

        child.stdout.on("data", (data: Buffer) => {
          writeStdout(stripAnsi(data.toString()));
        });
        child.stderr.on("data", (data: Buffer) => {
          writeStderr(transformErrors(stripAnsi(data.toString())));
        });

        child.on("exit", async (code) => {
          process.off("SIGINT", cleanupSync); // CTRL+C
          process.off("SIGQUIT", cleanupSync); // Keyboard quit
          process.off("SIGTERM", cleanupSync); // `kill` command
          cleanupSync();
          resolve(code ?? 0);
        });
      } catch {
        cleanupSync();
        resolve(1);
      }
    })();
  });
};

// ----------------------------------------------------------------

const readForDependencies = async (
  ast: AST,
  resolveData: ResolveData,
  filePath: string,
  checkFile: (filePath: string) => boolean
) => {
  const dependencies: Array<[string, "import" | "require", string]> = [];

  traverse(ast, (node: Node) => {
    switch (node.type) {
      case "ImportExpression": {
        if (node.source && node.source.value) {
          dependencies.push([node.source.value, "import", node.source.value]);
        }
        break;
      }
      case "ImportDeclaration": {
        if (node.source && node.source.value) {
          dependencies.push([node.source.value, "import", node.source.value]);
        }
        break;
      }
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration": {
        if (node.source && node.source.value) {
          dependencies.push([node.source.value, "import", node.source.value]);
        }
        break;
      }
      case "CallExpression": {
        if (!node || !node.arguments || node.arguments.length === 0) break;

        if (
          node.callee &&
          node.type === "CallExpression" &&
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          let result;
          const { type, value, quasis, tag, quasi } = node.arguments[0];
          if (type === "Literal" || type === "StringLiteral") result = value;
          if (type === "TemplateLiteral") result = quasis[0].value.cooked;
          if (
            type === "TaggedTemplateExpression" &&
            tag.type === "MemberExpression" &&
            tag.object.type === "Identifier" &&
            tag.object.name === "String" &&
            tag.property.type === "Identifier" &&
            tag.property.name === "raw"
          ) {
            result = quasi.quasis[0].value.cooked;
          }
          if (result) dependencies.push([result, "require", result]);
        } else if (
          node.callee &&
          node.type === "CallExpression" &&
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "MemberExpression" &&
          node.callee.object.object.type === "Identifier" &&
          node.callee.object.object.name === "require" &&
          node.callee.object.property.type === "Identifier" &&
          node.callee.object.property.name === "main" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "require"
        ) {
          dependencies.push([node.arguments[0].value, "require", node.arguments[0].value]);
        }

        break;
      }
      default:
      // nothing
    }
  });

  // apply resolve logic here
  if (dependencies.length > 0 && resolveData.matcher !== null) {
    for (const dependencyPair of dependencies) {
      const matches = resolveData.matcher(dependencyPair[0]);
      if (matches.length > 0) {
        for (const match of matches) {
          if (
            resolveLocalImport({
              type: dependencyPair[1],
              absImportPath: match,
              rawImportPath: dependencyPair[0],
              importedFrom: filePath,
              checkFile,
            })
          ) {
            dependencyPair[0] = match;
            break;
          }
        }
      }
    }
  }

  return dependencies;
};

// ----------------------------------------------------------------

const transformAST = async (
  rawInputPath: string,
  ast: AST,
  outputDirectory: string,
  relativeInputFile: string,
  internalSourceFilesMap: Map<string, FileResult>,
  dependencyMap: Map<string, string>,
  inputFile: string
) => {
  const ensure = (rawDependencyPath: string) => {
    let dependencyPath = dependencyMap.get(rawDependencyPath) ?? rawDependencyPath;

    if (dependencyPath.startsWith(".") || dependencyPath.startsWith("/")) {
      // convert absolute to relative
      if (dependencyPath.startsWith("/")) {
        let relativePath = path.relative(path.join(rawInputPath, ".."), dependencyPath);
        if (!relativePath.startsWith(".")) relativePath = "./" + relativePath;
        dependencyPath = relativePath + (dependencyPath.endsWith("/") ? "/" : "");
      }

      let internalSourceFile;
      {
        const lastIndexOfSlash = relativeInputFile.lastIndexOf("/");
        const pathWithoutSlash =
          lastIndexOfSlash === -1 ? "" : relativeInputFile.slice(0, lastIndexOfSlash);
        // both joins path and removes trailing slash

        const joinedPath = path.join(pathWithoutSlash, dependencyPath, ".");

        if (joinedPath === ".") {
          internalSourceFile = internalSourceFilesMap.get("index");
        } else if (dependencyPath.endsWith("/")) {
          internalSourceFile = internalSourceFilesMap.get(joinedPath + "/index");
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(joinedPath);
          }
          const ext = path.extname(joinedPath);
          const withoutExt = ext.length === 0 ? joinedPath : joinedPath.slice(0, -ext.length);
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(withoutExt);
          }
        } else {
          internalSourceFile = internalSourceFilesMap.get(joinedPath);
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(joinedPath + "/index");
          }
          const ext = path.extname(joinedPath);
          const withoutExt = ext.length === 0 ? joinedPath : joinedPath.slice(0, -ext.length);
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(withoutExt);
          }
        }

        if (internalSourceFile === undefined) {
          throw new Error(
            `Could not find a valid import value\nCould not resolve ${joinedPath}[/index.*] from ${relativeInputFile}`
          );
        }
      }

      const relativePathToDependency = path.relative(
        path.join(outputDirectory, relativeInputFile, ".."),
        internalSourceFile.outputFilePath
      );

      return relativePathToDependency.startsWith(".")
        ? relativePathToDependency
        : `./${relativePathToDependency}`;
    }

    return dependencyPath;
  };

  const promises: Array<Promise<void>> = [];

  traverse(ast, async (node: Node) => {
    switch (node.type) {
      case "ImportExpression": {
        if (node.source) {
          if (node.source.value) {
            const value = ensure(node.source.value);
            node.source = asLiteral(value);
          } else if (node.source.quasis) {
            const value = ensure(node.source.quasis[0].value.cooked);
            node.source.quasis = [
              {
                type: "TemplateElement",
                value: { raw: value, cooked: value },
                tail: true,
              },
            ];
          } else if (
            node.source.type === "TaggedTemplateExpression" &&
            node.source.tag.type === "MemberExpression" &&
            node.source.tag.object.type === "Identifier" &&
            node.source.tag.object.name === "String" &&
            node.source.tag.property.type === "Identifier" &&
            node.source.tag.property.name === "raw"
          ) {
            const value = ensure(node.source.quasi.quasis[0].value.cooked);
            node.source.quasi.quasis = [
              {
                type: "TemplateElement",
                value: { raw: value, cooked: value },
                tail: true,
              },
            ];
          }
        }
        break;
      }
      case "ImportDeclaration": {
        if (node.importKind === "type") break;
        if (node.source && node.source.value) {
          const defaultImport = node.specifiers.find((node: Node) => {
            return !node.imported;
          })?.local?.name;
          const namedImports = node.specifiers
            .filter((node: Node) => {
              return node.imported;
            })
            .map(({ local, imported }: { local: { name: string }; imported: { name: string } }) => {
              return [imported.name, local.name];
            });
          const value = ensure(node.source.value);
          const isExternalDependency = !(
            value.startsWith(".") ||
            value.startsWith("/") ||
            isNodeBuiltin(value)
          );

          if (namedImports.length > 0 && isExternalDependency) {
            const getDependencyEntryFilePath = async () => {
              let dependencyEntryFilePath: string;

              const requireResolve = require.resolve;

              try {
                const fileUrl = importResolve(value, "file://" + inputFile);
                dependencyEntryFilePath = fileURLToPath(fileUrl);
              } catch {
                try {
                  dependencyEntryFilePath = requireResolve(value, {
                    paths: [inputFile],
                  });
                } catch {
                  throw new Error(
                    `Could not import/require ${JSON.stringify(value)} from ${JSON.stringify(
                      inputFile
                    )}`
                  );
                }
              }

              return dependencyEntryFilePath;
            };

            promises.push(
              getDependencyEntryFilePath()
                .then((dependencyEntryFilePath) =>
                  determineModuleTypeFromPath(dependencyEntryFilePath)
                )
                .then((dependencyModuleType) => {
                  if (dependencyModuleType === ".cjs") {
                    const uniqueID = defaultImport ?? `xnr_${randomUUID().slice(-12)}`;

                    const cjs = {
                      type: "VariableDeclaration",
                      declarations: [
                        {
                          type: "VariableDeclarator",
                          id: {
                            type: "ObjectPattern",
                            properties: namedImports.map(([key, value]: [string, string]) => {
                              return {
                                type: "Property",
                                key: { type: "Identifier", name: key },
                                computed: false,
                                value: { type: "Identifier", name: value },
                                kind: "init",
                                method: false,
                                shorthand: key === value,
                              };
                            }),
                          },
                          init: { type: "Identifier", name: uniqueID },
                        },
                      ],
                      kind: "const",
                    };

                    node.specifiers = [
                      {
                        type: "ImportDefaultSpecifier",
                        local: { type: "Identifier", name: uniqueID },
                      },
                    ];
                    node.parent.splice(node.parent.indexOf(node) + 1, 0, cjs);
                  }
                })
            );
          }

          node.source = {
            type: "Literal",
            value,
            raw: value.includes("'") ? `"${value}"` : `'${value}'`,
          };
        }
        break;
      }
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration": {
        if (node.source && node.source.value) {
          const value = ensure(node.source.value);
          node.source = {
            type: "Literal",
            value,
            raw: value.includes("'") ? `"${value}"` : `'${value}'`,
          };
        }
        break;
      }
      case "CallExpression": {
        if (isCreateRequire(node)) {
          node.arguments = [
            {
              type: "MemberExpression",
              object: {
                type: "MetaProperty",
                meta: { type: "Identifier", name: "import" },
                property: { type: "Identifier", name: "meta" },
                __dnr: true,
              },
              property: { type: "Identifier", name: "url" },
              computed: false,
              optional: false,
            },
          ];
        } else if (isRequire(node)) {
          if (!node.arguments || node.arguments.length === 0) {
            break;
          }

          if (node.arguments[0].type === "Literal" || node.arguments[0].type === "StringLiteral") {
            const value = ensure(node.arguments[0].value);
            node.arguments[0] = asLiteral(value);
          }

          if (node.arguments[0].type === "TemplateLiteral") {
            const value = ensure(node.arguments[0].quasis[0].value.cooked);
            node.arguments[0].quasis = [
              {
                type: "TemplateElement",
                value: { raw: value, cooked: value },
                tail: true,
              },
            ];
          }

          if (
            node.arguments[0].type === "TaggedTemplateExpression" &&
            node.arguments[0].tag.type === "MemberExpression" &&
            node.arguments[0].tag.object.type === "Identifier" &&
            node.arguments[0].tag.object.name === "String" &&
            node.arguments[0].tag.property.type === "Identifier" &&
            node.arguments[0].tag.property.name === "raw"
          ) {
            const value = ensure(node.arguments[0].quasi.quasis[0].value.cooked);
            node.arguments[0].quasi.quasis = [
              {
                type: "TemplateElement",
                value: { raw: value, cooked: value },
                tail: true,
              },
            ];
          }
        } else if (isRequireMainRequire(node)) {
          const value = ensure(node.arguments[0].value);
          node.arguments[0] = asLiteral(value);
        }

        break;
      }
      case "MetaProperty": {
        if (
          !node.__dnr &&
          node.meta.name === "import" &&
          node.property.name === "meta" &&
          node.parent?.type === "MemberExpression"
        ) {
          const metaName = node.parent.property.name;
          if (metaName === "url") {
            replaceNode(node.parent, asLiteral(`file://${inputFile}`));
          } else if (metaName === "dirname") {
            replaceNode(node.parent, asLiteral(path.dirname(inputFile)));
          } else if (metaName === "filename") {
            replaceNode(node.parent, asLiteral(inputFile));
          } else if (metaName === "resolve") {
            replaceNode(
              node.parent,
              asLiteral(importResolve(node.parent.parent.arguments[0].value, "file://" + inputFile))
            );
          }
        }
        break;
      }
      case "Identifier": {
        {
          if (node.parent?.type !== "VariableDeclarator") {
            if (node.name === "__dirname") {
              replaceNode(node, asLiteral(path.relative(process.cwd(), path.dirname(inputFile))));
            } else if (node.name === "__filename") {
              replaceNode(node, asLiteral(path.relative(process.cwd(), inputFile)));
            }
          }
        }
        break;
      }
      default:
      // nothing
    }
  });

  await Promise.all(promises);

  return generate(ast);
};

const replaceNode = (node: Node, replacement: Node) => {
  if (node.parent?.splice === undefined) {
    // object
    for (const [key, value] of Object.entries(node.parent)) {
      if (value === node) {
        node.parent[key] = replacement;
      }
    }
  } else {
    // array
    node.parent.splice(node.parent.indexOf(node), 1, replacement);
  }
};

// const getStringValueFromStringishNode = (node: Node): string | undefined => {
//   let result: string | undefined;
//   const { type, value, quasis, tag, quasi } = node.arguments[0];
//   if (type === "Literal" || type === "StringLiteral") result = value;
//   if (type === "TemplateLiteral") result = quasis[0].value.cooked;
//   if (
//     type === "TaggedTemplateExpression" &&
//     tag.type === "MemberExpression" &&
//     tag.object.type === "Identifier" &&
//     tag.object.name === "String" &&
//     tag.property.type === "Identifier" &&
//     tag.property.name === "raw"
//   ) {
//     result = quasi.quasis[0].value.cooked;
//   }
//   return result;
// };

const asLiteral = (value: string) => {
  return {
    type: "Literal",
    value,
    raw: value.includes("'") ? `"${value}"` : `'${value}'`,
  };
};

const isRequire = (node: Node) => {
  if (!node) return false;

  const c = node.callee;
  return c && node.type === "CallExpression" && c.type === "Identifier" && c.name === "require";
};

const isCreateRequire = (node: Node) => {
  if (!node) return false;

  const c = node.callee;
  return (
    c && node.type === "CallExpression" && c.type === "Identifier" && c.name === "createRequire"
  );
};

const isRequireMainRequire = (node: Node) => {
  if (!node) return false;

  const c = node.callee;
  return (
    c &&
    node.type === "CallExpression" &&
    c.type === "MemberExpression" &&
    c.object.type === "MemberExpression" &&
    c.object.object.type === "Identifier" &&
    c.object.object.name === "require" &&
    c.object.property.type === "Identifier" &&
    c.object.property.name === "main" &&
    c.property.type === "Identifier" &&
    c.property.name === "require"
  );
};

const BUILTINS = new Set(builtinModules);
const isNodeBuiltin = (dependency: string): boolean => {
  if (dependency.startsWith("node:")) return true;
  if (dependency === "test") return false;
  return BUILTINS.has(dependency);
};

const traverse = (node: Node, perNode: (node: Node) => void) => {
  if (Array.isArray(node)) {
    for (const key of node) {
      if (isObject(key)) {
        key.parent = node;
        traverse(key as Node, perNode);
      }
    }
  } else if (node && isObject(node)) {
    perNode(node);

    for (const [key, value] of Object.entries(node)) {
      if (key === "parent" || !value) continue;
      if (isObject(value)) {
        value.parent = node;
      }
      traverse(value, perNode);
    }
  }
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

// -------------------------------------------------------------

const determineModuleTypeFromAST = async (ast: AST) => {
  let hasFoundExport = false;

  const traverse = (node: Node, perNode: (input: Node) => void) => {
    if (hasFoundExport) return;

    if (Array.isArray(node)) {
      for (const key of node) {
        if (isObject(key)) {
          key.parent = node;
          traverse(key, perNode);
        }
      }
    } else if (node && isObject(node)) {
      perNode(node);

      for (const [key, value] of Object.entries(node)) {
        if (key === "parent" || !value) continue;
        if (isObject(value)) {
          value.parent = node;
        }
        traverse(value, perNode);
      }
    }
  };

  traverse(ast, async (node: Node) => {
    switch (node.type) {
      case "ExportAllDeclaration":
      case "ExportDefaultDeclaration":
      case "ExportNamedDeclaration":
      case "ExportSpecifier":
      case "ImportAttribute":
      case "ImportDeclaration":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
      case "ImportSpecifier": {
        hasFoundExport = true;
        break;
      }
      default:
      // nothing
      // note "ImportExpression" not included as import() can appear in cjs
    }
  });

  return hasFoundExport ? ".mjs" : ".cjs";
};

const determineModuleTypeFromPath = async (
  dependencyEntryFilePath: string
): Promise<".cjs" | ".mjs"> => {
  const lowercaseExtension = dependencyEntryFilePath.toLowerCase().slice(-4);
  if (lowercaseExtension === ".cjs" || lowercaseExtension === ".mjs") {
    return lowercaseExtension;
  } else {
    const ast = parseModule(await fs.promises.readFile(dependencyEntryFilePath, "utf8"));
    return determineModuleTypeFromAST(ast);
  }
};

// ------

const tsconfigCache = new Map();
const resolverCache = new Map();

const getResolveData = (filePath: string): ResolveData => {
  const dirname = path.join(filePath, "..");
  const ext = path.extname(filePath);
  let tsconfig = tsconfigCache.get(dirname);
  if (tsconfig === undefined) {
    let tsconfig_ = getTsconfig(filePath, "tsconfig.json");
    if (tsconfig_ === null) tsconfig_ = getTsconfig(filePath, "jsconfig.json");
    tsconfigCache.set(dirname, tsconfig);
    tsconfig = tsconfig_;
  }
  if (tsconfig === null) {
    return {
      baseUrl: null,
      dirname,
      configPath: null,
      matcher: null,
      paths: {},
      ext,
    };
  }
  let resolver = resolverCache.get(tsconfig.path);
  if (resolver === undefined) {
    const baseUrl = tsconfig.config?.compilerOptions?.baseUrl;
    const resolver_ = {
      baseUrl,
      dirname,
      configPath: tsconfig.path,
      matcher: typeof baseUrl === "string" ? createPathsMatcher(tsconfig) : null,
      paths: tsconfig.config?.compilerOptions?.paths ?? {},
      ext,
    };
    resolverCache.set(tsconfig.path, resolver_);
    resolver = resolver_;
  }
  return resolver;
};

const KNOWN_EXT_REGEX = /\.([jt]sx?|[cm][jt]s)$/i;
type KnownExtension = "js" | "ts" | "jsx" | "tsx" | "cjs" | "cts" | "mjs" | "mts";
type Strategy = "ts>tsx" | "tsx>ts" | "mts" | "cts" | "mjs" | "cjs" | "js>jsx" | "jsx>js";

type ExtOrderMap = {
  [k in KnownExtension]?: Strategy[] | undefined;
};

const EXT_ORDER_MAP_MODULE: ExtOrderMap = {
  // ts
  ts: ["ts>tsx", "mts", "mjs", "js>jsx", "cts", "cjs"],
  tsx: ["tsx>ts", "jsx>js", "mts", "mjs", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx>ts", "jsx>js", "mts", "mjs"],
  mts: ["mts", "mjs", "ts>tsx", "js>jsx", "cts", "cjs"],
  // js
  jsx: ["jsx>js", "tsx>ts", "mjs", "mts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx>js", "tsx>ts", "mjs", "mts"],
  mjs: ["mjs", "mts", "js>jsx", "ts>tsx", "cjs", "cts"],
  // js, json* can use default order
};
const EXT_ORDER_MAP_COMMONJS: ExtOrderMap = {
  // ts
  ts: ["ts>tsx", "js>jsx", "cts", "cjs"],
  tsx: ["tsx>ts", "jsx>js", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx>ts", "jsx>js"],
  mts: ["mts", "mjs", "ts>tsx", "js>jsx", "cts", "cjs"],
  // js
  jsx: ["jsx>js", "tsx>ts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx>js", "tsx>ts"],
  mjs: ["mjs", "mts", "js>jsx", "ts>tsx", "cjs", "cts"],
  // js, json* can use default order
};

export const resolveLocalImport = ({
  type,
  absImportPath: absImportPathMaybeWithSlash,
  rawImportPath,
  importedFrom,
  checkFile,
}: {
  type: "require" | "import";
  absImportPath: string;
  rawImportPath: string;
  importedFrom: string;
  checkFile: (filePath: string) => boolean;
}): string => {
  const parentExt = path.extname(importedFrom);

  const doesImportPathEndWithSlash = absImportPathMaybeWithSlash.endsWith("/");
  const absImportPath = path.join(absImportPathMaybeWithSlash, ".");

  const isFileTsLike = Boolean(parentExt.includes("ts"));

  let defaultOrder: Strategy[];
  if (type === "import") {
    defaultOrder = isFileTsLike
      ? ["mts", "mjs", "ts>tsx", "js>jsx", "cts", "cjs"]
      : ["mjs", "mts", "js>jsx", "ts>tsx", "cjs", "cts"];
  } else {
    defaultOrder = isFileTsLike
      ? ["cts", "cjs", "ts>tsx", "js>jsx"]
      : ["cjs", "cts", "js>jsx", "ts>tsx"];
  }

  const t = (filePath: string): string | undefined => {
    if (checkFile(filePath)) return filePath;
  };

  const resolveAsDirectory = () => {
    for (const strategy of defaultOrder) {
      const file = runStrategy(absImportPath + "/index", strategy, t);
      if (file) return file;
    }
  };

  if (doesImportPathEndWithSlash) {
    const resolved = resolveAsDirectory();
    if (resolved) {
      return resolved;
    }
  }

  let knownImportExt = getKnownExt(absImportPath);
  if (knownImportExt) {
    if (isFileTsLike) {
      if (knownImportExt === "js") knownImportExt = "ts";
      else if (knownImportExt === "cjs") knownImportExt = "cts";
      else if (knownImportExt === "mjs") knownImportExt = "mts";
      else if (knownImportExt === "jsx") knownImportExt = "tsx";
    }
    const order =
      (type === "import"
        ? EXT_ORDER_MAP_MODULE[knownImportExt]
        : EXT_ORDER_MAP_COMMONJS[knownImportExt]) ?? defaultOrder;
    return (
      t(absImportPath.slice(0, -knownImportExt.length) + knownImportExt) ??
      resolveLocalImportKnownExt(
        absImportPath,
        order,
        t,
        resolveAsDirectory,
        importedFrom,
        rawImportPath
      )
    );
  } else {
    return resolveLocalImportUnknownExt(
      absImportPath,
      defaultOrder,
      t,
      resolveAsDirectory,
      importedFrom,
      rawImportPath
    );
  }
};

const resolveLocalImportUnknownExt = (
  absImportPath: string,
  order: Strategy[],
  t: (filePath: string) => string | undefined,
  resolveAsDirectory: () => string | undefined,
  importedFrom: string,
  rawImportPath: string
): string => {
  const file = t(absImportPath) ?? resolveAsDirectory();
  if (file) return file;

  for (const strategy of order) {
    const file = runStrategy(absImportPath, strategy, t);
    if (file) return file;
  }

  throw new Error(`Could not find import:\n  ${rawImportPath}\nfrom:\n  ${importedFrom}`);
};

const resolveLocalImportKnownExt = (
  absImportPath: string,
  order: Strategy[],
  t: (filePath: string) => string | undefined,
  resolveAsDirectory: () => string | undefined,
  importedFrom: string,
  rawImportPath: string
): string => {
  const file = resolveAsDirectory();
  if (file) return file;

  const absImportPathWithoutExt = absImportPath.slice(
    0,
    absImportPath.length - path.extname(absImportPath).length
  );

  for (const strategy of order) {
    const file = runStrategy(absImportPathWithoutExt, strategy, t);
    if (file) return file;
  }

  throw new Error(`Could not find import:\n  ${rawImportPath}\nfrom:\n  ${importedFrom}`);
};

const runStrategy = (
  base: string,
  strategy: Strategy,
  t: (filePath: string) => string | undefined
) => {
  // eslint-disable-next-line unicorn/prefer-switch
  if (strategy === "ts>tsx") {
    return t(base + ".ts") ?? t(base + ".tsx");
  } else if (strategy === "tsx>ts") {
    return t(base + ".tsx") ?? t(base + ".ts");
  } else if (strategy === "js>jsx") {
    return t(base + ".js") ?? t(base + ".jsx");
  } else if (strategy === "jsx>js") {
    return t(base + ".jsx") ?? t(base + ".js");
  } else if (strategy === "cts") {
    return t(base + ".cts");
  } else if (strategy === "mts") {
    return t(base + ".mts");
  } else if (strategy === "cjs") {
    return t(base + ".cjs");
  } else {
    return t(base + ".mjs");
  }
};

const getKnownExt = (filePath: string): KnownExtension | undefined => {
  const match = path.extname(filePath).match(KNOWN_EXT_REGEX);
  return match ? (match[0].slice(1).toLowerCase() as KnownExtension) : undefined;
};

const stripAnsi = (string: string) => {
  return string.replaceAll(
    // eslint-disable-next-line no-control-regex
    /\u001B\[\d+m/g,
    ""
  );
};
