import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import posix from "node:path/posix";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  AnyNode,
  AssignmentProperty,
  Expression,
  Literal,
  Program,
  VariableDeclaration,
} from "acorn";
import { ancestor, simple } from "acorn-walk";
import { generate } from "astring";
import { resolve as importResolve } from "import-meta-resolve";
import { transform as sucraseTransform } from "sucrase";

import {
  asLiteral,
  determineModuleTypeFromAST,
  getStringNodeValue,
  isCreateRequire,
  isNodeStringLiteral,
  isRequire,
  isRequireMainRequire,
  replaceNode,
} from "./astHelpers";
import {
  BasePathResolver,
  CouldNotFindImportError,
  determineModuleTypeFromPath,
  EXT_ORDER_MAP_COMMONJS,
  EXT_ORDER_MAP_MODULE,
  getContextualPathResolver,
  getKnownExt,
  isNodeBuiltin,
  KnownExtension,
  parseModule,
  stripAnsi,
  XnrError,
} from "./helpers";

type FileResult = {
  inputFile: string;
  outputFormat: ".cjs" | ".mjs";
  outputFilePath: string;
  dependencyMap: Map<string, string>;
};

/**
 * Transforms an input code string into a Node-friendly ECMAScript Module (ESM) code string.
 *
 * @param {Object} options - The options for transforming the code.
 * @param {string} options.code - The input code as a string.
 * @param {string} [options.filePath] - The path of the file being transformed.
 * @returns {Promise<string>} A promise that resolves with the transformed code.
 */
export const transform = async ({
  code: inputCode,
  filePath,
}: {
  code: string;
  filePath?: string;
}): Promise<string> => {
  const ext = posix.extname(filePath ?? "").toLowerCase();
  let { code } = sucraseTransform(inputCode, {
    transforms: ["typescript", ...(ext.endsWith("ts") ? [] : ["jsx" as const])],
    jsxPragma: "React.createClass",
    jsxFragmentPragma: "React.Fragment",
    filePath,
    enableLegacyTypeScriptModuleInterop: false,
    enableLegacyBabel5ModuleInterop: false,
    disableESTransforms: true,
    production: false,
  });
  if (code.startsWith("#!")) {
    code = code.slice(code.indexOf("\n") + 1);
  }
  return code;
};

/**
 * Represents the result of the build process, including the entry point and processed files.
 *
 * @typedef {Object} BuildResult
 * @property {string} entrypoint - The entry point file for the build.
 * @property {FileResult[]} files - An array of file results from the build process.
 */
export type BuildResult = {
  entrypoint: string;
  files: FileResult[];
};

type FileToProcess = {
  filePath: string;
  parentFilePath: string;
  /* This is used to improve error messages */
  rawImportPath: string;
};

/**
 * Converts the source code from an entry file into a directory of Node-friendly ESM code.
 *
 * @param {Object} options - The options for building the code.
 * @param {string} options.filePath - The path of the entry file.
 * @param {string} options.outputDirectory - The directory where the output files will be saved.
 * @returns {Promise<BuildResult>} A promise that resolves with the build result, containing the entry point and file details.
 */
export const build = async ({
  filePath,
  outputDirectory,
}: {
  filePath: string;
  outputDirectory: string;
}): Promise<BuildResult> => {
  outputDirectory = posix.resolve(outputDirectory);

  const astCache = new Map<string, Program>();
  const fsCache = new Map<string, Map<string, string>>();
  const resolverCache = new Map<string, BasePathResolver>();

  const getResolvedFile = (filePath: string): string | undefined => {
    const parentDirectory = posix.join(filePath, "..");
    const name = filePath.slice(parentDirectory.length + 1);
    let filesSet = fsCache.get(parentDirectory);
    if (!filesSet) {
      filesSet = new Map<string, string>();
      try {
        for (const dirent of fs.readdirSync(parentDirectory, { withFileTypes: true })) {
          if (dirent.isFile()) {
            filesSet.set(dirent.name, posix.resolve(parentDirectory, dirent.name));
          } else if (dirent.isSymbolicLink()) {
            filesSet.set(
              dirent.name,
              posix.resolve(
                parentDirectory,
                fs.readlinkSync(posix.join(parentDirectory, dirent.name))
              )
            );
          }
        }
        fsCache.set(parentDirectory, filesSet);
      } catch {
        // Do not report an error here, as it will be reported later
      }
    }
    return filesSet.get(name);
  };

  const firstFile: FileToProcess = {
    filePath: resolveLocalImport({
      absImportPath: posix.resolve(filePath),
      importedFrom: "",
      method: "import",
      getResolvedFile,
      rawImportPath: filePath,
    }),
    parentFilePath: posix.extname(filePath),
    rawImportPath: filePath,
  };

  const fileStack: FileToProcess[] = [firstFile];
  const explored = new Set();
  const internalSourceFiles: Omit<FileResult, "outputFilePath">[] = [];
  while (fileStack.length > 0) {
    const { filePath, parentFilePath } = fileStack.pop()!;

    if (!explored.has(filePath)) {
      explored.add(filePath);

      const actualFileString = await fs.promises.readFile(filePath, "utf8");

      if (posix.extname(filePath).toLowerCase().startsWith(".json")) {
        // special case if the file is json
        const ast: Program = parseModule("module.exports = " + actualFileString);
        astCache.set(filePath, ast);
        internalSourceFiles.push({
          inputFile: filePath,
          outputFormat: ".cjs",
          dependencyMap: new Map<string, string>(),
        });
      } else {
        const ast: Program = parseModule(await transform({ code: actualFileString, filePath }));
        astCache.set(filePath, ast);
        const resolvePaths = getContextualPathResolver(filePath, resolverCache);
        const rawImports = await readImports(ast);
        const localResolvedImports: { importPath: string; resolved: string }[] = [];
        for (const rawImport of rawImports) {
          const paths = resolvePaths(rawImport.importPath);
          let firstError: XnrError | undefined;
          for (const path_ of paths) {
            if (path_.startsWith(".") || path_.startsWith("/")) {
              const absImportPath = posix.resolve(filePath, "..", path_);
              try {
                const resolved = resolveLocalImport({
                  absImportPath,
                  rawImportPath: rawImport.importPath,
                  importedFrom: filePath,
                  method: rawImport.method,
                  getResolvedFile,
                });
                if (resolved) {
                  localResolvedImports.push({
                    importPath: rawImport.importPath,
                    resolved,
                  });
                  break;
                }
              } catch (error) {
                if (error instanceof XnrError) {
                  firstError ??= error;
                } else {
                  /* istanbul ignore next */
                  throw error;
                }
              }
            }
          }
          if (firstError) {
            throw firstError;
          }
        }

        const dependencyMap = new Map(
          localResolvedImports.map(({ importPath: path, resolved }) => {
            return [path, resolved];
          })
        );
        for (const { importPath, resolved } of localResolvedImports) {
          if (resolved.startsWith(".") || resolved.startsWith("/")) {
            const nextFilePath = posix.resolve(filePath, "..", resolved);
            fileStack.push({
              filePath: nextFilePath,
              parentFilePath,
              rawImportPath: importPath,
            });
          }
        }

        internalSourceFiles.push({
          inputFile: filePath,
          outputFormat: await determineModuleTypeFromAST(ast),
          dependencyMap,
        });
      }
    }
  }

  // Find common root directory of all source files
  let commonRootPath = internalSourceFiles[0].inputFile;
  while (commonRootPath !== "/") {
    commonRootPath = posix.join(commonRootPath, "..");
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
    internalSourceFiles.map(({ inputFile, outputFormat, dependencyMap }) => {
      let outputPath = outputDirectory + "/" + inputFile.slice(commonRootPath.length + 1);
      outputPath =
        outputPath.slice(0, outputPath.length - posix.extname(outputPath).length) + outputFormat;
      const outputFilePath = posix.resolve(outputDirectory, outputPath);
      if (outputEntryFilePath === "") {
        outputEntryFilePath = outputFilePath;
      }

      return [
        posix.relative(
          outputDirectory,
          outputFilePath.slice(0, outputFilePath.length - posix.extname(outputFilePath).length)
        ),
        { inputFile, outputFormat, outputFilePath, dependencyMap },
      ];
    })
  );

  const files = [...internalSourceFilesMap.values()];

  await Promise.all(
    files.map(async ({ inputFile, outputFilePath, dependencyMap }) => {
      const newFile = await transformAST({
        ast: astCache.get(inputFile)!,
        outputDirectory,
        relativeInputFile: posix.relative(commonRootPath, inputFile),
        internalSourceFilesMap,
        dependencyMap,
        inputFile,
      });

      /* Enable require from esm */
      await fs.promises.mkdir(posix.join(outputFilePath, ".."), { recursive: true });
      await fs.promises.writeFile(outputFilePath, "#!/usr/bin/env node\n" + newFile);
    })
  );

  return { entrypoint: outputEntryFilePath, files };
};

export type RunConfig = {
  filePath: string;
  args?: string[];
  nodeArgs?: string[];
  outputDirectory?: string | undefined;
  writeStdout?: (message: string) => void;
  writeStderr?: (message: string) => void;
};

/**
 * Runs a file with auto-transpilation of it and its dependencies, as required.
 *
 * @param {string|RunConfig} filePathOrConfig - The path of the file to run or a configuration object.
 * @param {string} [filePathOrConfig.filePath] - The path of the file to run.
 * @param {string[]} [filePathOrConfig.args] - Arguments to pass to the script.
 * @param {string[]} [filePathOrConfig.nodeArgs] - Node.js arguments to pass when running the script.
 * @param {string} [filePathOrConfig.outputDirectory] - Directory for storing output files.
 * @param {Function} [filePathOrConfig.writeStdout] - Function to handle standard output.
 * @param {Function} [filePathOrConfig.writeStderr] - Function to handle standard error output.
 * @returns {Promise<number>} A promise that resolves with the exit code of the process.
 */
export const run = async (filePathOrConfig: string | RunConfig): Promise<number> => {
  const {
    filePath,
    args = [],
    nodeArgs = [],
    outputDirectory: outputDirectory_ = undefined,
    writeStdout = process.stdout.write.bind(process.stdout),
    writeStderr = process.stderr.write.bind(process.stderr),
  } = typeof filePathOrConfig === "string" ? { filePath: filePathOrConfig } : filePathOrConfig;

  let outputDirectory: string;
  {
    if (outputDirectory_) {
      outputDirectory = posix.resolve(outputDirectory_);
    } else {
      let current = posix.resolve(filePath);
      let packageJsonPath: string | undefined;
      while (current !== "/") {
        const packageJsonPath_ = posix.join(current, "package.json");
        if (fs.existsSync(packageJsonPath_)) {
          packageJsonPath = packageJsonPath_;
          break;
        }
        current = posix.join(current, "..");
      }
      outputDirectory = packageJsonPath
        ? posix.join(packageJsonPath, "../node_modules/.cache/xnr")
        : posix.join(process.cwd(), ".tmp/xnr");
    }
  }

  const cleanupSync = () => {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  };

  return new Promise<number>((resolve) => {
    void (async () => {
      try {
        const { entrypoint, files } = await build({ filePath, outputDirectory });

        const outputDirectoryErrorLocationRegex = new RegExp(
          `(${outputDirectory.replaceAll(
            /[$()*+.?[\\\]^{|}]/g,
            String.raw`\$&`
          )}/[^:\n]*)(?::\\d+){0,2}`,
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
                const nextPartStartIndex = match.index + match[0].length;
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
          writeStderr(transformErrors(stripAnsi(data.toString())) + "\n");
        });

        child.on("exit", (code: number | null) => {
          process.off("SIGINT", cleanupSync); // CTRL+C
          process.off("SIGQUIT", cleanupSync); // Keyboard quit
          process.off("SIGTERM", cleanupSync); // `kill` command
          cleanupSync();
          resolve(code ?? 0);
        });
      } catch (error) {
        if (error instanceof XnrError) {
          writeStderr(error.message);
          writeStderr("\n");
        } else {
          /* istanbul ignore next */
          if (error instanceof Error) {
            /* istanbul ignore next */ {
              writeStderr(
                "Unexpected error when running xnr\nIf you are on the latest version, please report this issue on GitHub\n"
              );
              writeStderr(error.stack ?? error.message);
              writeStderr("\n");
            }
          }
        }
        cleanupSync();
        resolve(1);
      }
    })();
  });
};

// ----------------------------------------------------------------

const readImports = async (ast: Program) => {
  const imports: {
    method: "import" | "require";
    importPath: string;
  }[] = [];

  const pushSourceAsDep = (node: { source?: Expression | Literal | null | undefined }) => {
    if (isNodeStringLiteral(node.source)) {
      const path = getStringNodeValue(node.source);
      if (path) imports.push({ method: "import", importPath: path });
    }
  };

  simple(ast, {
    ImportExpression: pushSourceAsDep,
    ImportDeclaration: pushSourceAsDep,
    ExportNamedDeclaration: pushSourceAsDep,
    ExportAllDeclaration: pushSourceAsDep,
    CallExpression(node) {
      if (isRequire(node)) {
        const path = getStringNodeValue(node.arguments[0]);
        if (path) imports.push({ method: "require", importPath: path });
      } else if (isRequireMainRequire(node)) {
        const path = getStringNodeValue(node.arguments[0]);
        if (path) imports.push({ method: "require", importPath: path });
      }
    },
  });

  return imports;
};

// ----------------------------------------------------------------

const transformAST = async ({
  ast,
  outputDirectory,
  relativeInputFile,
  internalSourceFilesMap,
  dependencyMap,
  inputFile,
}: {
  ast: Program;
  outputDirectory: string;
  relativeInputFile: string;
  internalSourceFilesMap: Map<string, FileResult>;
  dependencyMap: Map<string, string>;
  inputFile: string;
}) => {
  const ensure = (rawDependencyPath: string) => {
    let dependencyPath = dependencyMap.get(rawDependencyPath) ?? rawDependencyPath;

    if (dependencyPath.startsWith(".") || dependencyPath.startsWith("/")) {
      // convert absolute to relative
      if (dependencyPath.startsWith("/")) {
        let relativePath = posix.relative(posix.join(inputFile, ".."), dependencyPath);
        if (!relativePath.startsWith(".")) relativePath = "./" + relativePath;
        dependencyPath = relativePath + (dependencyPath.endsWith("/") ? "/" : "");
      }

      let internalSourceFile: FileResult | undefined;
      {
        const lastIndexOfSlash = relativeInputFile.lastIndexOf("/");
        const pathWithoutSlash =
          lastIndexOfSlash === -1 ? "" : relativeInputFile.slice(0, lastIndexOfSlash);

        // both joins path and removes trailing slash
        const joinedPath = posix.join(pathWithoutSlash, dependencyPath, ".");

        internalSourceFile =
          internalSourceFilesMap.get(joinedPath + "/index") ??
          internalSourceFilesMap.get(joinedPath);
        const ext = posix.extname(joinedPath);
        const withoutExt = ext.length === 0 ? joinedPath : joinedPath.slice(0, -ext.length);
        if (internalSourceFile === undefined) {
          internalSourceFile = internalSourceFilesMap.get(withoutExt);
        }

        if (internalSourceFile === undefined) {
          /* istanbul ignore next */
          throw new XnrError(
            `Could not find a valid import value\nCould not resolve ${rawDependencyPath}: ${joinedPath}[/index.*] from ${relativeInputFile}`
          );
        }
      }

      const relativePathToDependency = posix.relative(
        posix.join(outputDirectory, relativeInputFile, ".."),
        internalSourceFile.outputFilePath
      );

      return relativePathToDependency.startsWith(".")
        ? relativePathToDependency
        : `./${relativePathToDependency}`;
    }

    return dependencyPath;
  };

  const promises: Promise<void>[] = [];

  const rewriteSourceString = (toRewrite: AnyNode | null | undefined) => {
    const value = getStringNodeValue(toRewrite);
    if (toRewrite && value) {
      replaceNode(toRewrite, asLiteral(ensure(value)));
    }
  };
  const rewriteNodeWithSource = (node: { source?: AnyNode | null | undefined }) => {
    rewriteSourceString(node.source);
  };
  const rewriteNodeWithSourceAsFirstArg = (node: { arguments?: AnyNode[] }) => {
    const arg = node.arguments?.[0];
    rewriteSourceString(arg);
  };

  ancestor(ast, {
    ImportExpression: rewriteNodeWithSource,
    ImportDeclaration(node, _, ancestors) {
      const parent = ancestors.at(-2) as AnyNode | undefined;
      if (isNodeStringLiteral(node.source) && parent && parent.type === "Program") {
        const defaultImport = node.specifiers.find((node) => node.type === "ImportDefaultSpecifier")
          ?.local?.name;
        const namedImports = node.specifiers
          .filter((node) => node.type === "ImportSpecifier")
          .map((node): [string | undefined, string] => {
            return [
              node.imported.type === "Identifier" ? node.imported.name : getStringNodeValue(node),
              node.local.name,
            ];
          })
          .filter((value): value is [string, string] => value[0] !== undefined);

        const value = ensure(node.source.value);
        const isExternalDependency = !(
          value.startsWith(".") ||
          value.startsWith("/") ||
          isNodeBuiltin(value)
        );

        if (namedImports.length > 0 && isExternalDependency) {
          const getDependencyEntryFilePath = async () => {
            let dependencyEntryFilePath: string;

            try {
              const fileUrl = importResolve(value, "file://" + inputFile);
              dependencyEntryFilePath = fileURLToPath(fileUrl);
            } catch {
              throw new XnrError(
                `Could not import ${JSON.stringify(value)} from ${toNiceFilePath(inputFile)}`
              );
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

                  const cjs: VariableDeclaration = {
                    type: "VariableDeclaration",
                    declarations: [
                      {
                        type: "VariableDeclarator",
                        id: {
                          type: "ObjectPattern",
                          properties: namedImports.map(
                            ([key, value]: [string, string]): AssignmentProperty => {
                              return {
                                type: "Property",
                                key: { type: "Identifier", name: key, start: -1, end: -1 },
                                computed: false,
                                value: { type: "Identifier", name: value, start: -1, end: -1 },
                                kind: "init",
                                method: false,
                                shorthand: key === value,
                                start: -1,
                                end: -1,
                              };
                            }
                          ),
                          start: -1,
                          end: -1,
                        },
                        init: { type: "Identifier", name: uniqueID, start: -1, end: -1 },
                        start: -1,
                        end: -1,
                      },
                    ],
                    kind: "const",
                    start: -1,
                    end: -1,
                  };

                  node.specifiers = [
                    {
                      type: "ImportDefaultSpecifier",
                      local: { type: "Identifier", name: uniqueID, start: -1, end: -1 },
                      start: -1,
                      end: -1,
                    },
                  ];

                  parent.body.splice(parent.body.indexOf(node) + 1, 0, cjs);
                }
              })
          );
        }

        node.source = asLiteral(value);
      }
    },
    ExportNamedDeclaration: rewriteNodeWithSource,
    ExportAllDeclaration: rewriteNodeWithSource,
    CallExpression(node) {
      if (isCreateRequire(node)) {
        node.arguments = [
          {
            type: "MemberExpression",
            object: {
              type: "MetaProperty",
              meta: { type: "Identifier", name: "import", start: -1, end: -1 },
              property: { type: "Identifier", name: "meta", start: -1, end: -1 },
              start: -1,
              end: -1,
            },
            property: { type: "Identifier", name: "url", start: -1, end: -1 },
            computed: false,
            optional: false,
            start: -1,
            end: -1,
          },
        ];
      } else if (isRequire(node)) {
        rewriteNodeWithSourceAsFirstArg(node);
      } else if (isRequireMainRequire(node)) {
        const value = getStringNodeValue(node.arguments[0]);
        if (value) {
          node.arguments[0] = asLiteral(ensure(value));
        }
      }
    },
    MetaProperty(node, _, ancestors) {
      const parent = ancestors.at(-2) as AnyNode | undefined;
      const grandParent = ancestors.at(-3) as AnyNode | undefined;
      if (
        node.meta.name === "import" &&
        node.property.name === "meta" &&
        parent?.type === "MemberExpression"
      ) {
        const metaName =
          parent.property.type === "Identifier"
            ? parent.property.name
            : getStringNodeValue(parent.property);
        if (metaName === "url") {
          replaceNode(parent, asLiteral(`file://${inputFile}`));
        } else if (metaName === "dirname") {
          replaceNode(parent, asLiteral(posix.dirname(inputFile)));
        } else if (metaName === "filename") {
          replaceNode(parent, asLiteral(inputFile));
        } else if (metaName === "resolve" && grandParent?.type === "CallExpression") {
          const value = getStringNodeValue(grandParent.arguments[0]);
          if (
            value &&
            (value.startsWith(".") || value.startsWith("/") || value.startsWith("file://"))
          ) {
            grandParent.arguments[0] = asLiteral(new URL(value, `file://${inputFile}`).href);
          }
        }
      }
    },
    Identifier(node, _) {
      if (node.name === "__dirname") {
        replaceNode(node, asLiteral(posix.relative(process.cwd(), posix.dirname(inputFile))));
      } else if (node.name === "__filename") {
        replaceNode(node, asLiteral(posix.relative(process.cwd(), inputFile)));
      }
    },
  });

  await Promise.all(promises);

  return generate(ast);
};

export const resolveLocalImport = ({
  method,
  absImportPath: absImportPathMaybeWithSlash,
  importedFrom,
  getResolvedFile,
  rawImportPath,
}: {
  method: "require" | "import";
  absImportPath: string;
  importedFrom: string;
  getResolvedFile: (filePath: string) => string | undefined;
  rawImportPath: string;
}): string => {
  const parentExt = posix.extname(importedFrom).slice(1).toLowerCase();
  const absImportPath = posix.join(absImportPathMaybeWithSlash, ".");

  const isParentTsFile = ["ts", "mts", "tsx", "cts"].includes(parentExt);
  let knownImportExt = getKnownExt(absImportPath);
  if (knownImportExt && isParentTsFile) {
    // Recent versions of TypeScript ask users to import .*ts* files as .*js*
    if (knownImportExt === "js") knownImportExt = "ts";
    else if (knownImportExt === "cjs") knownImportExt = "cts";
    else if (knownImportExt === "mjs") knownImportExt = "mts";
    else if (knownImportExt === "jsx") knownImportExt = "tsx";
  }

  // other includes js, json and unknown/missing extensions
  const otherExtOrder =
    method === "import"
      ? EXT_ORDER_MAP_MODULE[parentExt as KnownExtension] ??
        EXT_ORDER_MAP_MODULE[isParentTsFile ? "mts" : "mjs"]
      : EXT_ORDER_MAP_MODULE[parentExt as KnownExtension] ??
        EXT_ORDER_MAP_MODULE[isParentTsFile ? "cts" : "cjs"];

  const resolveAsDirectory = () => {
    for (const ext of otherExtOrder) {
      const file = getResolvedFile(absImportPath + "/index." + ext);
      if (file) return file;
    }
  };

  try {
    if (knownImportExt) {
      const order =
        (method === "import"
          ? EXT_ORDER_MAP_MODULE[knownImportExt]
          : EXT_ORDER_MAP_COMMONJS[knownImportExt]) ?? otherExtOrder;

      return (
        getResolvedFile(absImportPath.slice(0, -knownImportExt.length) + knownImportExt) ??
        resolveLocalImportKnownExt({
          absImportPath,
          order,
          getResolvedFile,
          resolveAsDirectory,
        })
      );
    } else {
      return resolveLocalImportUnknownExt({
        absImportPath,
        order: otherExtOrder,
        getResolvedFile,
        resolveAsDirectory,
      });
    }
  } catch (error) {
    throw error instanceof CouldNotFindImportError
      ? new XnrError(
          `Could not find import:\n  ${rawImportPath}${
            importedFrom ? `\nfrom:\n  ${toNiceFilePath(importedFrom)}` : ""
          }`
        )
      : error;
  }
};

const toNiceFilePath = (filePath: string) => {
  return filePath.startsWith(process.cwd()) ? posix.relative(process.cwd(), filePath) : filePath;
};

const resolveLocalImportUnknownExt = ({
  absImportPath,
  order,
  getResolvedFile,
  resolveAsDirectory,
}: {
  absImportPath: string;
  order: readonly KnownExtension[];
  getResolvedFile: (filePath: string) => string | undefined;
  resolveAsDirectory: () => string | undefined;
}): string => {
  const file = getResolvedFile(absImportPath) ?? resolveAsDirectory();
  if (file) return file;

  for (const ext of order) {
    const file = getResolvedFile(absImportPath + "." + ext);
    if (file) return file;
  }

  throw new CouldNotFindImportError();
};

const resolveLocalImportKnownExt = ({
  absImportPath,
  order,
  getResolvedFile,
  resolveAsDirectory,
}: {
  absImportPath: string;
  order: readonly KnownExtension[];
  getResolvedFile: (filePath: string) => string | undefined;
  resolveAsDirectory: () => string | undefined;
}): string => {
  const file = resolveAsDirectory();
  if (file) return file;

  const absImportPathWithoutExt = absImportPath.slice(
    0,
    absImportPath.length - posix.extname(absImportPath).length
  );

  for (const ext of order) {
    const file = getResolvedFile(absImportPathWithoutExt + "." + ext);
    if (file) return file;
  }

  throw new CouldNotFindImportError();
};

export { XnrError } from "./helpers";
