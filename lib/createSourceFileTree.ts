import fs from "node:fs";
import fsPath from "node:path";
import { fileURLToPath } from "node:url";

import { Expression, Literal, Program } from "acorn";
import { simple } from "acorn-walk";
import { createPathsMatcher, getTsconfig, TsConfigResult } from "get-tsconfig";

import { getStringNodeValue, isNodeStringLiteral, isRequire, isRequireMainRequire } from "./ast";
import { transformSync } from "./transform";
import {
  Dependency,
  determineModuleType,
  getNpmPackageFromImport,
  isNodeBuiltin,
  KnownExtension,
  parseModule,
  prettyPath,
  SourceFileNode,
  SucraseOptions,
  XnrError,
} from "./utils";

const EXT_ORDER_MAP_MODULE: Record<KnownExtension, KnownExtension[]> = {
  // ts
  ts: ["ts", "tsx", "mts", "mjs", "js", "jsx", "cts", "cjs"],
  tsx: ["tsx", "ts", "jsx", "js", "mts", "mjs", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx", "ts", "jsx", "js", "mts", "mjs"],
  mts: ["mts", "mjs", "ts", "tsx", "js", "jsx", "cts", "cjs"],
  // js
  jsx: ["jsx", "js", "tsx", "ts", "mjs", "mts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx", "js", "tsx", "ts", "mjs", "mts"],
  mjs: ["mjs", "mts", "js", "jsx", "ts", "tsx", "cjs", "cts"],
  js: ["js", "jsx", "mjs", "mts", "ts", "tsx", "cjs", "cts"],
};
const EXT_ORDER_MAP_COMMONJS: Record<KnownExtension, KnownExtension[]> = {
  // ts
  ts: ["ts", "tsx", "js", "jsx", "cts", "cjs"],
  tsx: ["tsx", "ts", "jsx", "js", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx", "ts", "jsx", "js"],
  mts: ["mts", "mjs", "ts", "tsx", "js", "jsx", "cts", "cjs"],
  // js
  jsx: ["jsx", "js", "tsx", "ts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx", "js", "tsx", "ts"],
  mjs: ["mjs", "mts", "js", "jsx", "ts", "tsx", "cjs", "cts"],
  js: ["js", "jsx", "ts", "tsx", "cjs", "cts"],
};

class XnrCannotResolveError extends Error {
  constructor() {
    super();
    this.name = "XnrCannotResolveError";
  }
}

export const createSourceFileTree = ({
  entry,
  getSucraseOptions = () => ({}),
}: {
  entry: string;
  getSucraseOptions?: (absFilePath: string) => SucraseOptions;
}): SourceFileNode => {
  const resolve = createResolve();
  const absPath = fsPath.resolve(entry);

  let absResolvedPath: string;
  try {
    absResolvedPath = resolve({ absPath, method: determineModuleType(absPath) });
  } catch (error) {
    if (error instanceof XnrCannotResolveError) {
      throw new XnrError(`Could not find entry:\n  ${prettyPath(absPath)}`);
    }
    throw error;
  }

  return createSourceFileTreeRecursive({
    absResolvedPath,
    resolve,
    getSucraseOptions,
    astCache: new Map<string, Program>(),
    resultCache: new Map<string, SourceFileNode>(),
    resolverCache: new Map<string, BasePathResolver>(),
  });
};

const isJsonExt = (absFilePath: string) => {
  const ext = fsPath.extname(absFilePath).slice(1).toLowerCase();
  return ext.startsWith("json");
};

const createSourceFileTreeRecursive = ({
  absResolvedPath,
  resolve,
  getSucraseOptions,
  astCache,
  resultCache,
  resolverCache,
}: {
  absResolvedPath: string;
  resolve: ReturnType<typeof createResolve>;
  getSucraseOptions: (absFilePath: string) => SucraseOptions;
  astCache: Map<string, Program>;
  resultCache: Map<string, SourceFileNode>;
  resolverCache: Map<string, BasePathResolver>;
}): SourceFileNode => {
  let code = fs.readFileSync(absResolvedPath, "utf8");

  if (isJsonExt(absResolvedPath)) {
    code = "module.exports = " + code;
  }

  const ast: Program = parseModule(
    transformSync({
      code,
      filePath: absResolvedPath,
      sucraseOptions: getSucraseOptions(absResolvedPath),
    })
  );
  astCache.set(absResolvedPath, ast);

  const resolvePaths = getContextualPathResolver(absResolvedPath, resolverCache);

  const sourceFile: SourceFileNode = {
    path: absResolvedPath,
    ast,
    localDependencies: [],
    externalDependencies: [],
  };
  resultCache.set(absResolvedPath, sourceFile);

  const dependencies = readImports(ast).flatMap((rawImport): Dependency[] => {
    const tsResolvedPaths = resolvePaths(rawImport.importPath);
    let firstError: XnrCannotResolveError | undefined;
    for (const tsResolvedPath of tsResolvedPaths) {
      const isFileUrl = tsResolvedPath.startsWith("file://");

      const npmPackage = getNpmPackageFromImport(rawImport.importPath);

      if (npmPackage) {
        return [
          {
            type: "external",
            method: rawImport.method,
            path: rawImport.importPath,
            package: npmPackage,
          },
        ];
      } else if (isNodeBuiltin(rawImport.importPath)) {
        return [];
      } else {
        const absTsResolvedPath = fsPath.resolve(
          fsPath.dirname(absResolvedPath),
          isFileUrl ? fileURLToPath(tsResolvedPath) : tsResolvedPath
        );

        try {
          const absResolvedImportPath = resolve({
            absPath: absTsResolvedPath,
            method: rawImport.method,
          });

          const cachedResult = resultCache.get(absResolvedImportPath);
          const method = isJsonExt(absResolvedImportPath) ? "require" : rawImport.method;
          return cachedResult
            ? [{ type: "local", method, raw: rawImport.importPath, file: cachedResult }]
            : [
                {
                  type: "local",
                  method,
                  raw: rawImport.importPath,
                  file: createSourceFileTreeRecursive({
                    absResolvedPath: absResolvedImportPath,
                    resolve,
                    astCache,
                    resultCache,
                    resolverCache,
                    getSucraseOptions,
                  }),
                },
              ];
        } catch (error) {
          if (error instanceof XnrCannotResolveError) {
            firstError ??= error;
          } else {
            /* istanbul ignore next */
            throw error;
          }
        }
      }
    }
    if (firstError) {
      throw new XnrError(
        `Could not find import:\n  ${prettyPath(rawImport.importPath)}\nfrom:\n  ${prettyPath(
          absResolvedPath
        )}`
      );
    }
    throw new Error("Unreachable");
  });

  for (const dependency of dependencies) {
    if (dependency.type === "external") {
      sourceFile.externalDependencies.push(dependency);
    } else {
      sourceFile.localDependencies.push(dependency);
    }
  }

  return sourceFile;
};

// ---

const isNotNormalAbsPath = (path: string) => {
  return !fsPath.isAbsolute(path) || path !== fsPath.normalize(path);
};

const KNOWN_EXT_SET = new Set<KnownExtension>(
  // prettier-ignore
  ["js", "ts", "jsx", "tsx", "cjs", "cts", "mjs", "mts"]
);

const getKnownExt = (absPath: string): KnownExtension | undefined => {
  if (isNotNormalAbsPath(absPath)) {
    throw new Error("Expected absolute path");
  }

  const ext = fsPath.extname(absPath).slice(1).toLowerCase();
  return KNOWN_EXT_SET.has(ext as KnownExtension) ? (ext as KnownExtension) : undefined;
};

/**
 * Create a function that can be used to get the resolved path of a file.
 *
 * Only accepts absolute paths.
 *
 * Follows symlinks
 */
export const createResolve = () => {
  const fsCache = new Map<string, Map<string, string>>();

  /**
   * Follows symlinks
   */
  const getFilePath = (absPath: string): string | undefined => {
    if (isNotNormalAbsPath(absPath)) {
      throw new Error("Expected absolute path");
    }

    const parent = fsPath.dirname(absPath);
    let filesSet = fsCache.get(parent);
    if (!filesSet) {
      filesSet = new Map<string, string>();
      try {
        for (const dirent of fs.readdirSync(parent, { withFileTypes: true })) {
          if (dirent.isFile()) {
            filesSet.set(dirent.name, fsPath.resolve(parent, dirent.name));
          } else if (dirent.isSymbolicLink()) {
            filesSet.set(
              dirent.name,
              fsPath.resolve(parent, fs.readlinkSync(fsPath.join(parent, dirent.name)))
            );
          }
        }
        fsCache.set(parent, filesSet);
      } catch {}
    }

    return filesSet.get(fsPath.relative(parent, absPath));
  };

  const resolve = ({
    absPath,
    method,
    absFromPath,
    fromExt = absFromPath ? getKnownExt(absFromPath) ?? "tsx" : "tsx",
  }: {
    absPath: string;
    method: "import" | "require";
    absFromPath?: string;
    fromExt?: KnownExtension;
  }): string => {
    if (isNotNormalAbsPath(absPath)) {
      throw new Error("Expected absolute path");
    }

    const ext = getKnownExt(absPath);
    const isParentTsFile = ["ts", "mts", "tsx", "cts"].includes(fromExt);
    if (isParentTsFile) {
      // Recent versions of TypeScript ask users to import .*ts* files as .*js*
      if (ext === "js") fromExt = "ts";
      else if (ext === "cjs") fromExt = "cts";
      else if (ext === "mjs") fromExt = "mts";
      else if (ext === "jsx") fromExt = "tsx";
    }

    const order =
      method === "import" ? EXT_ORDER_MAP_MODULE[fromExt] : EXT_ORDER_MAP_COMMONJS[fromExt];

    // resolve as directory
    for (const ext of order) {
      const file = getFilePath(fsPath.join(absPath, "index." + ext));
      if (file) return file;
    }

    // resolve as exact
    const file = getFilePath(absPath);
    if (file) return file;

    // resolve with other extensions
    const absPathExt = fsPath.extname(absPath);
    const absPathWithoutExt = absPath.slice(0, absPath.length - absPathExt.length);
    for (const ext of order) {
      const toResolve = absPathWithoutExt + "." + ext;
      if (toResolve !== absPath) {
        const file = getFilePath(toResolve);
        if (file) return file;
      }
    }

    throw new XnrCannotResolveError();
  };

  return resolve;
};

const readImports = (ast: Program) => {
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
      if (isRequireMainRequire(node) || isRequire(node)) {
        const path = getStringNodeValue(node.arguments[0]);
        if (path) imports.push({ method: "require", importPath: path });
      }
    },
  });

  return imports;
};

type BasePathResolver = (specifier: string) => string[];
const getContextualPathResolver = (
  absFilePath: string,
  resolverCache: Map<string, BasePathResolver>
): BasePathResolver => {
  const dirname = fsPath.dirname(absFilePath);
  const resolveData = resolverCache.get(dirname);
  if (resolveData === undefined) {
    const tsconfig: TsConfigResult = getTsconfig(absFilePath, "tsconfig.json") ??
      getTsconfig(absFilePath, "jsconfig.json") ?? {
        path: "",
        config: { compilerOptions: { baseUrl: undefined, paths: {} } },
      };
    const resolver = createPathsMatcher(tsconfig) ?? ((input: string) => [input]);
    resolverCache.set(dirname, resolver);
    return resolver;
  } else {
    return resolveData;
  }
};
