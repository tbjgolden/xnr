import fs from "node:fs";
import { builtinModules } from "node:module";
import posix from "node:path/posix";
import process from "node:process";

import { Options, parse, Program } from "acorn";
import { findNodeAt } from "acorn-walk";
import { createPathsMatcher, getTsconfig, TsConfigResult } from "get-tsconfig";

export const parseModule = (a: string, b?: Options) => {
  return parse(a, { ...b, sourceType: "module", ecmaVersion: "latest" });
};

export class XnrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XnrError";
  }
}

export class CouldNotFindImportError extends Error {
  constructor() {
    super();
    this.name = "CouldNotFindImportError";
  }
}

const BUILTINS = new Set(builtinModules);
export const isNodeBuiltin = (dependency: string): boolean => {
  if (dependency.startsWith("node:")) return true;
  if (dependency === "test") return false;
  return BUILTINS.has(dependency);
};

const MODULE_ONLY_NODE_TYPE_SET = new Set([
  "ExportAllDeclaration",
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
  "ExportSpecifier",
  "ImportAttribute",
  "ImportDeclaration",
  "ImportDefaultSpecifier",
  "ImportNamespaceSpecifier",
  "ImportSpecifier",
]);

const determineModuleTypeFromAST = async (ast: Program) => {
  return findNodeAt(ast, undefined, undefined, (nodeType) =>
    MODULE_ONLY_NODE_TYPE_SET.has(nodeType)
  )
    ? ".mjs"
    : ".cjs";
};

export const determineModuleTypeFromPath = async (
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

export type BasePathResolver = (specifier: string) => string[];
export const getContextualPathResolver = (
  filePath: string,
  resolverCache: Map<string, BasePathResolver>
): BasePathResolver => {
  const dirname = posix.join(filePath, "..");
  const resolveData = resolverCache.get(dirname);
  if (resolveData === undefined) {
    const tsconfig: TsConfigResult = getTsconfig(filePath, "tsconfig.json") ??
      getTsconfig(filePath, "jsconfig.json") ?? {
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

export type KnownExtension = "js" | "ts" | "jsx" | "tsx" | "cjs" | "cts" | "mjs" | "mts";

export const EXT_ORDER_MAP_MODULE = {
  // ts
  ts: ["ts", "tsx", "mts", "mjs", "js", "jsx", "cts", "cjs"],
  tsx: ["tsx", "ts", "jsx", "js", "mts", "mjs", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx", "ts", "jsx", "js", "mts", "mjs"],
  mts: ["mts", "mjs", "ts", "tsx", "js", "jsx", "cts", "cjs"],
  // js
  jsx: ["jsx", "js", "tsx", "ts", "mjs", "mts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx", "js", "tsx", "ts", "mjs", "mts"],
  mjs: ["mjs", "mts", "js", "jsx", "ts", "tsx", "cjs", "cts"],
  // use default order
  js: undefined,
} as const;
export const EXT_ORDER_MAP_COMMONJS = {
  // ts
  ts: ["ts", "tsx", "js", "jsx", "cts", "cjs"],
  tsx: ["tsx", "ts", "jsx", "js", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx", "ts", "jsx", "js"],
  mts: ["mts", "mjs", "ts", "tsx", "js", "jsx", "cts", "cjs"],
  // js
  jsx: ["jsx", "js", "tsx", "ts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx", "js", "tsx", "ts"],
  mjs: ["mjs", "mts", "js", "jsx", "ts", "tsx", "cjs", "cts"],
  // use default order
  js: undefined,
} as const;

export const toNiceFilePath = (filePath: string) => {
  return filePath.startsWith(process.cwd()) ? posix.relative(process.cwd(), filePath) : filePath;
};

const KNOWN_EXT_REGEX = /\.([jt]sx?|[cm][jt]s)$/i;
export const getKnownExt = (filePath: string): KnownExtension | undefined => {
  const match = KNOWN_EXT_REGEX.exec(posix.extname(filePath));
  return match ? (match[0].slice(1).toLowerCase() as KnownExtension) : undefined;
};

export const stripAnsi = (string: string) => {
  return string.replaceAll(
    // eslint-disable-next-line no-control-regex
    /\u001B\[\d+m/g,
    ""
  );
};
