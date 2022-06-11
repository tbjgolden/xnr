import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import path from "node:path/posix";
import { generate } from "astring";
const { parseModule } = require("esprima-next");

export const updateImports = async (fileString) => {
  const ast = parseModule(fileString);

  traverse(ast, (node) => {
    switch (node.type) {
      case "ImportExpression":
        if (node.source) {
          if (node.source.value) {
            const value = ensureMJS(node.source.value);
            node.source = {
              type: "Literal",
              value,
              raw: value.includes("'") ? `"${value}"` : `'${value}'`,
            };
          } else if (node.source.quasis) {
            const value = ensureMJS(node.source.quasis[0].value.cooked);
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
            const value = ensureMJS(node.source.quasi.quasis[0].value.cooked);
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
          const value = ensureMJS(node.source.value);
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
          const value = ensureMJS(node.source.value);
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
            const value = ensureMJS(node.arguments[0].value);
            node.arguments[0] = {
              type: "Literal",
              value,
              raw: value.includes("'") ? `"${value}"` : `'${value}'`,
            };
          }

          if (node.arguments[0].type === "TemplateLiteral") {
            const value = ensureCJS(node.arguments[0].quasis[0].value.cooked);
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
            const value = ensureMJS(node.arguments[0].quasi.quasis[0].value.cooked);
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

  return generate(ast);
};

const ensureMJS = (dependencyPath) => {
  if (dependencyPath.startsWith(".") || dependencyPath.startsWith("/")) {
    const ext = path.extname(dependencyPath);
    if (ext !== ".mjs") {
      return dependencyPath + ".mjs";
    }
  }
  return dependencyPath;
};
const ensureCJS = (dependencyPath) => {
  if (dependencyPath.startsWith(".") || dependencyPath.startsWith("/")) {
    const ext = path.extname(dependencyPath);
    if (ext !== ".cjs") {
      return dependencyPath + ".cjs";
    }
  }
  return dependencyPath;
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

const isRequire = (node) => {
  if (!node) return false;

  const c = node.callee;

  return (
    c && node.type === "CallExpression" && c.type === "Identifier" && c.name === "require"
  );
};
