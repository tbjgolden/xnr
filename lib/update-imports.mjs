import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import path from "node:path/posix";
import { generate } from "astring";
import { isNodeBuiltin } from "./shared.mjs";
const { parseModule } = require("esprima-next");
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { determineModuleType } from "./determine-module-type.mjs";

export const updateImports = async (fileString) => {
  const ast = parseModule(fileString);
  const promises = [];

  traverse(ast, async (node) => {
    switch (node.type) {
      case "ImportExpression":
        if (node.source) {
          if (node.source.value) {
            const value = ensureMJS(node.source.value);
            node.source = asLiteral(value);
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
          const defaultImport = node.specifiers.find((node) => !node.imported)
            ?.local?.name;
          const namedImports = node.specifiers
            .filter((node) => node.imported)
            .map(({ local, imported }) => [imported.name, local.name]);
          const value = ensureMJS(node.source.value);
          const isExternalDependency = !(
            value.startsWith(".") ||
            value.startsWith("/") ||
            isNodeBuiltin(value)
          );

          if (namedImports.length > 0 && isExternalDependency) {
            promises.push(
              import.meta
                .resolve(value)
                .then((resolvedUrl) => {
                  return fileURLToPath(resolvedUrl);
                })
                .then((dependencyEntryFilePath) => {
                  return determineModuleType(dependencyEntryFilePath);
                })
                .then((dependencyModuleType) => {
                  if (dependencyModuleType === "cjs") {
                    const index = node.parent.indexOf(node);

                    if (index !== -1) {
                      const uniqueID =
                        defaultImport ?? `just_run_${randomUUID().slice(-12)}`;

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

            const dependencyEntryFilePath = fileURLToPath(
              await import.meta.resolve(value)
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
          const value = ensureMJS(node.source.value);
          node.source = {
            type: "Literal",
            value,
            raw: value.includes("'") ? `"${value}"` : `'${value}'`,
          };
        }
        break;
      case "CallExpression":
        if (
          !isRequire(node) ||
          !node.arguments ||
          node.arguments.length === 0
        ) {
          break;
        }

        if (isRequire(node)) {
          if (
            node.arguments[0].type === "Literal" ||
            node.arguments[0].type === "StringLiteral"
          ) {
            const value = ensureMJS(node.arguments[0].value);
            node.arguments[0] = asLiteral(value);
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
            const value = ensureMJS(
              node.arguments[0].quasi.quasis[0].value.cooked
            );
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

const isExternalDependency = (dependencyPath) => {
  if (dependencyPath.startsWith(".") || dependencyPath.startsWith("/")) {
    return false;
  }
  if (isNodeBuiltin) {
    return false;
  }
  return true;
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
    c &&
    node.type === "CallExpression" &&
    c.type === "Identifier" &&
    c.name === "require"
  );
};
