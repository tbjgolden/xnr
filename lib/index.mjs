import fs from "node:fs";
import path from "node:path/posix";
import { fork } from "node:child_process";
import { createRequire, builtinModules } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "url";
import { generate } from "astring";
import { transform } from "sucrase";
import { getTsconfig, createPathsMatcher } from "get-tsconfig";
const require = createRequire(import.meta.url);
const { parseModule } = require("esprima-next");

/**
 * Convert source code from an entry file into a directory of node-friendly esm code
 * @param {string} entryFilePath
 * @param {string | undefined} outputDirectory @default path.join(process.cwd(), ".xnrb")
 * @returns {Promise<string | undefined>} outputEntryFilePath
 */
export const build = async (
  entryFilePath,
  outputDirectory = path.join(process.cwd(), ".xnrb")
) => {
  outputDirectory = path.resolve(outputDirectory);

  const astCache = new Map();

  const firstFilePath = path.resolve(process.cwd(), entryFilePath);
  const fileStack = [
    {
      filePath: firstFilePath,
      likelyExtension: path.extname(firstFilePath),
      entryMethod: "entry",
    },
  ];
  const explored = new Set();
  const internalSourceFiles = [];
  while (fileStack.length > 0) {
    const { filePath, likelyExtension, entryMethod: _ } = fileStack.pop();
    if (!explored.has(filePath)) {
      explored.add(filePath);

      // 1. find file from filepath, likelyExtension and entryMethod
      let actualFilePath = await findActualFilePath(filePath, likelyExtension);
      // 2. get as input string
      const actualFileString = await fs.promises.readFile(actualFilePath, "utf8");
      // 3. use sucrase to turn it into output string, store for later
      let { code } = transform(actualFileString, {
        transforms: ["typescript", ...(actualFilePath.endsWith(".ts") ? [] : ["jsx"])],
        jsxPragma: "React.createClass",
        jsxFragmentPragma: "React.Fragment",
        enableLegacyTypeScriptModuleInterop: false,
        enableLegacyBabel5ModuleInterop: false,
        filePath: actualFilePath,
        production: false,
        disableESTransforms: true,
      });
      // 4. remove hashbang line
      if (code.startsWith("#!")) {
        code = code.slice(code.indexOf("\n") + 1);
      }
      // #. parse into an ast. cache for later key by filepath
      const ast = parseModule(code);
      astCache.set(filePath, ast);
      // #. find config file if hasn't already found one for this dir
      const pathResolvers = getPathResolvers(filePath);
      // #. read file for imports/exports/requires
      const dependencies = (await readForDependencies(ast, pathResolvers)).filter(
        ([dependency]) => !isNodeBuiltin(dependency)
      );
      // #. filter to internal dependencies
      for (const [dependency, entryMethod] of dependencies) {
        if (dependency.startsWith(".") || dependency.startsWith("/")) {
          const nextFilePath = path.resolve(actualFilePath, "..", dependency);

          fileStack.push({
            filePath: nextFilePath,
            likelyExtension: path.extname(nextFilePath) || likelyExtension,
            entryMethod,
          });
        }
      }
      // #. push results into array
      internalSourceFiles.push({
        rawInputFile: filePath,
        inputFile: actualFilePath,
        outputFormat: await determineModuleTypeFromAST(ast),
      });
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

  let outputEntryFilePath;

  const internalSourceFilesMap = new Map(
    internalSourceFiles.map(({ rawInputFile, inputFile, outputFormat }) => {
      let outputPath = outputDirectory + "/" + inputFile.slice(commonRootPath.length + 1);
      outputPath =
        outputPath.slice(0, outputPath.length - path.extname(outputPath).length) +
        outputFormat;
      const outputFilePath = path.resolve(outputDirectory, outputPath);

      return [
        path.relative(
          outputDirectory,
          outputFilePath.slice(
            0,
            outputFilePath.length - path.extname(outputFilePath).length
          )
        ),
        {
          rawInputFile,
          inputFile,
          outputFormat,
          outputFilePath,
        },
      ];
    })
  );

  console.log(internalSourceFilesMap);

  await Promise.all(
    [...internalSourceFilesMap.values()].map(
      async ({ rawInputFile, inputFile, outputFormat, outputFilePath }) => {
        const newFile = await updateImports(
          rawInputFile,
          astCache.get(rawInputFile),
          outputDirectory,
          path.relative(commonRootPath, inputFile),
          internalSourceFilesMap
        );

        /* Enable require from esm */
        let prelude = "#!/usr/bin/env node\n";
        if (outputFormat === ".mjs" && !newFile.includes("createRequire")) {
          prelude =
            "import { createRequire } from 'node:module';\n" +
            "const require = createRequire(import.meta.url);\n";
        }

        if (outputEntryFilePath === undefined) {
          outputEntryFilePath = outputFilePath;
        }

        await fs.promises.mkdir(path.join(outputFilePath, ".."), {
          recursive: true,
        });
        await fs.promises.writeFile(outputFilePath, prelude + newFile);
      }
    )
  );

  return outputEntryFilePath;
};

/**
 * Runs a file, no questions asked (auto-transpiling it and its dependencies as required)
 * @param {string} entryFilePath
 * @param {string[]} args
 * @param {string | undefined} outputDirectory @default path.join(process.cwd(), ".xnrb")
 * @returns {Promise<string | undefined>} outputEntryFilePath
 */
export const run = async (
  entryFilePath,
  args = [],
  outputDirectory = path.join(process.cwd(), ".xnr")
) => {
  const outputEntryFilePath = await build(entryFilePath, outputDirectory);

  if (outputEntryFilePath === undefined) {
    console.error("No entry file to run");
    process.exit(1);
  } else {
    const child = fork(outputEntryFilePath, args, { stdio: "inherit" });
    child.on("exit", async (code) => {
      await fs.promises.rm(outputDirectory, { recursive: true, force: true });
      process.exit(code);
    });
  }
};

const findActualFilePath = async (filePath, likelyExtension = "") => {
  try {
    if ((await fs.promises.lstat(filePath)).isFile()) {
      return filePath;
    }
  } catch {}

  const dirname = path.dirname(filePath);
  const filename = filePath.slice(dirname.length + 1);
  const anyExt = new Set();
  let hasSub = false;
  // scan dirs for possible matches
  for (const dirContent of await fs.promises.readdir(dirname, {
    withFileTypes: true,
  })) {
    if (dirContent.name === filename || dirContent.name.startsWith(filename + ".")) {
      if (dirContent.isFile()) {
        anyExt.add(dirContent.name);
      } else if (dirContent.isDirectory() && dirContent.name === filename) {
        hasSub = true;
      }
    }
  }
  const subAnyExt = new Set();
  if (hasSub) {
    for (const dirContent of await fs.promises.readdir(filePath, {
      withFileTypes: true,
    })) {
      if (dirContent.name === "index" || dirContent.name.startsWith("index.")) {
        if (dirContent.isFile()) subAnyExt.add(dirContent.name);
      }
    }
  }
  // compare possible matches in sensible order
  if (likelyExtension !== "") {
    if (subAnyExt.has("index" + likelyExtension)) {
      // sub/index.likelyExtension
      return filePath + "/index" + likelyExtension;
    }
    if (anyExt.has(filename + likelyExtension)) {
      // sub.likelyExtension
      return filePath + likelyExtension;
    }
  }
  const EXTENSION_ORDER = [likelyExtension, ".tsx", ".ts", ".mjs", ".cjs", ".jsx", ".js"];
  for (const EXT of EXTENSION_ORDER) {
    if (subAnyExt.has("index" + EXT)) {
      // sub/index.commonExtension
      return filePath + "/index" + EXT;
    }
  }
  for (const EXT of EXTENSION_ORDER) {
    if (anyExt.has(filename + EXT)) {
      // sub.commonExtension
      return filePath + EXT;
    }
  }
  if (subAnyExt.has("index")) {
    // sub/index
    return filePath + "/index";
  }
  if (subAnyExt.size === 1) {
    // sub/index.any
    return filePath + "/index" + subAnyExt.values().next().value;
  }
  if (anyExt.size === 1) {
    // sub.any
    return filePath + anyExt.values().next().value;
  }
  throw new Error(`Could not resolve ${path.relative(process.cwd(), filePath)}`);
};

// ----------------------------------------------------------------

const readForDependencies = async (ast, pathResolvers) => {
  const dependencies = [];

  traverse(ast, (node) => {
    switch (node.type) {
      case "ImportExpression":
        if (node.source && node.source.value) {
          dependencies.push([node.source.value, "import"]);
        }
        break;
      case "ImportDeclaration":
        if (node.source && node.source.value) {
          dependencies.push([node.source.value, "import"]);
        }
        break;
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration":
        if (node.source && node.source.value) {
          dependencies.push([node.source.value, "import"]);
        }
        break;
      case "CallExpression":
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
          if (result) dependencies.push([result, "require"]);
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
          dependencies.push([node.arguments[0].value, "require"]);
        }

        break;
      default:
      // nothing
    }
  });

  console.log("A", dependencies);

  console.log(pathResolvers);

  // apply resolve logic here
  if (dependencies.length > 0 && pathResolvers.matcher !== null) {
    for (const dependencyPair of dependencies) {
      console.log("");
      console.log(dependencyPair[0]);
      const matches = pathResolvers.matcher(dependencyPair[0]);
      if (matches.length > 0) {
        for (const match of matches) {
          try {
            console.log(match);
            const actualPath = await findActualFilePath(match);
            dependencyPair[0] = actualPath;
            console.log("!!", actualPath);
          } catch {}
        }
      }
    }
  }

  console.log("B", dependencies);

  return dependencies;
};

// ----------------------------------------------------------------

const updateImports = async (
  rawInputFile,
  ast,
  outputDirectory,
  relativeInputFile,
  internalSourceFilesMap
) => {
  const ensure = (dependencyPath) => {
    if (dependencyPath.startsWith(".") || dependencyPath.startsWith("/")) {
      let internalSourceFile;
      {
        const lastIndexOfSlash = relativeInputFile.lastIndexOf("/");
        const pathWithoutSlash =
          lastIndexOfSlash === -1 ? "" : relativeInputFile.slice(0, lastIndexOfSlash);
        // both joins path and removes trailing slash
        const joinedPath = path.join(pathWithoutSlash, dependencyPath, ".");

        if (dependencyPath.endsWith("/")) {
          internalSourceFile = internalSourceFilesMap.get(joinedPath + "/index");
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(joinedPath);
          }
          const ext = path.extname(joinedPath);
          const withoutExt =
            ext.length === 0 ? joinedPath : joinedPath.slice(0, -ext.length);
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(withoutExt);
          }
        } else {
          internalSourceFile = internalSourceFilesMap.get(joinedPath);
          if (internalSourceFile === undefined) {
            internalSourceFile = internalSourceFilesMap.get(joinedPath + "/index");
          }
          const ext = path.extname(joinedPath);
          const withoutExt =
            ext.length === 0 ? joinedPath : joinedPath.slice(0, -ext.length);
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

  const promises = [];

  traverse(ast, async (node) => {
    switch (node.type) {
      case "ImportExpression":
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
      case "ImportDeclaration":
        if (node.importKind === "type") break;
        if (node.source && node.source.value) {
          const defaultImport = node.specifiers.find((node) => !node.imported)?.local
            ?.name;
          const namedImports = node.specifiers
            .filter((node) => node.imported)
            .map(({ local, imported }) => [imported.name, local.name]);
          const value = ensure(node.source.value);
          const isExternalDependency = !(
            value.startsWith(".") ||
            value.startsWith("/") ||
            isNodeBuiltin(value)
          );

          if (namedImports.length > 0 && isExternalDependency) {
            promises.push(
              import.meta
                .resolve(value, "file://" + rawInputFile)
                .then((resolvedUrl) => {
                  return fileURLToPath(resolvedUrl);
                })
                .then((dependencyEntryFilePath) => {
                  return determineModuleTypeFromPath(dependencyEntryFilePath);
                })
                .then((dependencyModuleType) => {
                  if (dependencyModuleType === ".cjs") {
                    const index = node.parent.indexOf(node);

                    if (index !== -1) {
                      const uniqueID = defaultImport ?? `xnr_${randomUUID().slice(-12)}`;

                      const cjs = {
                        type: "VariableDeclaration",
                        declarations: [
                          {
                            type: "VariableDeclarator",
                            id: {
                              type: "ObjectPattern",
                              properties: namedImports.map(([key, value]) => {
                                return {
                                  type: "Property",
                                  key: { type: "Identifier", name: key },
                                  computed: false,
                                  value: { type: "Identifier", name: value },
                                  kind: "init",
                                  method: false,
                                  shorthand: true,
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
                      node.parent.splice(index + 1, 0, cjs);
                    }
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
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration":
        if (node.source && node.source.value) {
          const value = ensure(node.source.value);
          node.source = {
            type: "Literal",
            value,
            raw: value.includes("'") ? `"${value}"` : `'${value}'`,
          };
        }
        break;
      case "CallExpression":
        if (!isRequire(node) || !node.arguments || node.arguments.length === 0) {
          break;
        }

        if (isRequire(node)) {
          if (
            node.arguments[0].type === "Literal" ||
            node.arguments[0].type === "StringLiteral"
          ) {
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
        }

        break;
      default:
      // nothing
    }
  });

  await Promise.all(promises);

  return generate(ast);
};

const asLiteral = (value) => {
  return {
    type: "Literal",
    value,
    raw: value.includes("'") ? `"${value}"` : `'${value}'`,
  };
};

const isRequire = (node) => {
  if (!node) return false;

  const c = node.callee;

  return (
    c && node.type === "CallExpression" && c.type === "Identifier" && c.name === "require"
  );
};

const BUILTINS = new Set(builtinModules);
const isNodeBuiltin = (dependency) => {
  if (dependency.startsWith("node:")) return true;
  if (dependency === "test") return false;
  return BUILTINS.has(dependency);
};

const traverse = (node, perNode) => {
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

const isObject = (value) => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

// -------------------------------------------------------------

const determineModuleTypeFromAST = async (ast) => {
  let hasFoundExport = false;

  const traverse = (node, perNode) => {
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

  traverse(ast, async (node) => {
    switch (node.type) {
      case "ExportAllDeclaration":
      case "ExportDefaultDeclaration":
      case "ExportNamedDeclaration":
      case "ExportSpecifier":
      case "ImportAttribute":
      case "ImportDeclaration":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
      case "ImportSpecifier":
        hasFoundExport = true;
        break;
      default:
      // nothing
      // note "ImportExpression" not included as import() can appear in cjs
    }
  });

  return hasFoundExport ? ".mjs" : ".cjs";
};

const determineModuleTypeFromPath = async (dependencyEntryFilePath) => {
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

const getPathResolvers = (filePath) => {
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
      baseUrl,
      dirname,
      configPath: null,
      matcher: null,
      baseUrl: null,
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
