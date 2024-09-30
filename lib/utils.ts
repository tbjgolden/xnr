import fs from "node:fs";
import { builtinModules } from "node:module";
import fsPath from "node:path";

import { Options as AcornOptions, parse, Program } from "acorn";
import { findNodeAt } from "acorn-walk";
import { Options as SucraseOptions_ } from "sucrase";

import { transformSync } from "./transform";

export type Method = "import" | "require";
export type KnownExtension = "js" | "ts" | "jsx" | "tsx" | "cjs" | "cts" | "mjs" | "mts";

const KNOWN_EXT_SET = new Set(
  // prettier-ignore
  ["js", "ts", "jsx", "tsx", "cjs", "cts", "mjs", "mts"]
);

export const getKnownExt = (filePath: string): KnownExtension | undefined => {
  const ext = fsPath.extname(filePath).slice(1).toLowerCase();
  return KNOWN_EXT_SET.has(ext) ? (ext as KnownExtension) : undefined;
};

export class XnrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XnrError";
  }
}

export const prettyPath = (filePath: string) => {
  return filePath.startsWith(process.cwd()) ? fsPath.relative(process.cwd(), filePath) : filePath;
};

export const parseModule = (code: string, options?: AcornOptions) => {
  return parse(code, { ...options, sourceType: "module", ecmaVersion: "latest" });
};

export const findClosestPackageJson = (absFilePath: string): string | undefined => {
  let current = fsPath.dirname(absFilePath);
  while (true) {
    const packageJsonPath = fsPath.join(current, "package.json");
    try {
      fs.openSync(packageJsonPath, "r");
      return packageJsonPath;
    } catch {}
    const next = fsPath.dirname(current);
    if (next === current) {
      return undefined;
    }
    current = next;
  }
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

export const determineModuleType = (absFilePath: string): Method => {
  const knownExt = getKnownExt(absFilePath);
  if (knownExt === "mjs" || knownExt === "mts") {
    return "import";
  } else if (knownExt === "cjs" || knownExt === "cts") {
    return "require";
  } else {
    let code: string;
    try {
      code = fs.readFileSync(absFilePath, "utf8");
      const ast = parseModule(transformSync({ code, filePath: absFilePath }));
      return findNodeAt(ast, undefined, undefined, (nodeType) =>
        MODULE_ONLY_NODE_TYPE_SET.has(nodeType)
      )
        ? "import"
        : "require";
    } catch {
      const closestPackageJson = findClosestPackageJson(absFilePath);
      if (closestPackageJson === undefined) {
        return "require";
      } else {
        try {
          const json = fs.readFileSync(closestPackageJson, "utf8");
          try {
            const pkgJson: unknown = JSON.parse(json);
            return typeof pkgJson === "object" &&
              pkgJson !== null &&
              "type" in pkgJson &&
              pkgJson.type === "module"
              ? "import"
              : "require";
          } catch {
            throw new XnrError(`Could not parse ${prettyPath(closestPackageJson)}`);
          }
        } catch {
          throw new XnrError(`Could not read ${prettyPath(closestPackageJson)}`);
        }
      }
    }
  }
};

const BUILTIN_MODULES_SET = new Set(builtinModules);
export const isNodeBuiltin = (rawImport: string): boolean => {
  return rawImport.startsWith("node:") || BUILTIN_MODULES_SET.has(rawImport);
};

export const escapeRegExp = (str: string) => {
  return str.replaceAll(/[$()*+./?[\\\]^{|}]/g, String.raw`\$&`);
};

export const stripAnsi = (string: string) => {
  return string.replaceAll(
    // eslint-disable-next-line no-control-regex
    /\u001B\[\d+m/g,
    ""
  );
};

const INVALID_NAME_SET = new Set(["node_modules", "favicon.ico", ...builtinModules]);
const NPM_IMPORT_REGEX = /^(?:(@[^/]+)\/)?([^/]+)/;

export const getNpmPackageFromImport = (importPath: string): string | undefined => {
  if (
    importPath === "" ||
    importPath.startsWith(".") ||
    importPath.startsWith("_") ||
    importPath.trim() !== importPath
  ) {
    return undefined;
  }
  const nameLower = importPath.toLowerCase();
  if (INVALID_NAME_SET.has(nameLower)) {
    return undefined;
  }
  const nameMatch = NPM_IMPORT_REGEX.exec(importPath);
  if (nameMatch) {
    const scope = nameMatch[1];
    const pkg = nameMatch[2];
    if (scope && scope !== encodeURIComponent(scope)) {
      return undefined;
    }
    if (pkg !== encodeURIComponent(pkg)) {
      return undefined;
    }
    return scope ? `${scope}${pkg}` : pkg;
  } else {
    return undefined;
  }
};

export const isExternalDependency = (importPath: string): boolean => {
  return Boolean(getNpmPackageFromImport(importPath));
};

export type SucraseOptions = Omit<SucraseOptions_, "transforms" | "filePath">;

export type LocalDependency = {
  type: "local";
  method: Method;
  raw: string;
  file: SourceFileNode;
};

export type ExternalDependency = {
  type: "external";
  method: Method;
  path: string;
  package: string;
};

export type Dependency = LocalDependency | ExternalDependency;

export type SourceFileNode = {
  path: string;
  ast: Program;
  localDependencies: LocalDependency[];
  externalDependencies: ExternalDependency[];
};
