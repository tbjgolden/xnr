import fs from "node:fs";
import { builtinModules } from "node:module";
import fsPath from "node:path";

import { Options as AcornOptions, parse } from "acorn";
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

export type SucraseOptions = Omit<SucraseOptions_, "transforms" | "filePath">;
export type GetSucraseOptions = (absFilePath: string) => SucraseOptions;
