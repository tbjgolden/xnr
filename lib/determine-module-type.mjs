import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseModule } = require("esprima-next");

export const determineModuleType = async (dependencyEntryFilePath) => {
  const lowercaseExtension = dependencyEntryFilePath.toLowerCase().slice(-4);
  if (lowercaseExtension === ".cjs") {
    return "cjs";
  } else if (lowercaseExtension === ".mjs") {
    return "mjs";
  } else {
    // deliberately don't try and work it out from package.json
    // but instead try and see if it has an import/export anywhere
    const ast = parseModule(await fs.promises.readFile(dependencyEntryFilePath, "utf8"));
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
        // case "ImportExpression": import() can appear in cjs
        case "ImportDeclaration":
        case "ImportDefaultSpecifier":
        case "ImportNamespaceSpecifier":
        case "ImportSpecifier":
          hasFoundExport = true;
          break;
        default:
        // nothing
      }
    });

    return hasFoundExport ? "mjs" : "cjs";
  }
};

const isObject = (value) => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
