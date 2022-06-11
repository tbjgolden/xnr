import fs from "node:fs";
import path from "node:path";
import { parse } from "@typescript-eslint/typescript-estree";
import { isNodeBuiltin } from "./shared.mjs";

export const getDependencies = async (filename) => {
  let fileString;
  try {
    fileString = await fs.promises.readFile(filename, "utf8");
  } catch {
    throw new Error(`xnr couldn't read ${JSON.stringify(filename)}`);
  }
  const dependencies =
    path.extname(filename).toLowerCase() === ".tsx"
      ? tsx(fileString)
      : ts(fileString);

  return dependencies.filter(([dependency]) => !isNodeBuiltin(dependency));
};

const tsGeneral = (content, isTSX) => {
  const dependencies = [];

  if (content === "") return dependencies;

  walk(
    content,
    (node) => {
      switch (node.type) {
        case "ImportExpression":
          if (node.source && node.source.value) {
            dependencies.push([node.source.value, true]);
          }
          break;
        case "ImportDeclaration":
          if (node.importKind === "type") break;
          if (node.source && node.source.value) {
            dependencies.push([node.source.value, true]);
          }
          break;
        case "ExportNamedDeclaration":
        case "ExportAllDeclaration":
          if (node.source && node.source.value) {
            dependencies.push([node.source.value, true]);
          }
          break;
        case "TSExternalModuleReference":
          if (node.expression && node.expression.value) {
            dependencies.push([node.expression.value, true]);
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

          if (isPlainRequire(node)) {
            const result = extractDependencyFromRequire(node);
            if (result) {
              dependencies.push([result, false]);
            }
          } else if (isMainScopedRequire(node)) {
            dependencies.push([extractDependencyFromMainRequire(node), false]);
          }

          break;
        default:
        // nothing
      }
    },
    isTSX
  );

  return dependencies;
};

function extractDependencyFromRequire(node) {
  if (
    node.arguments[0].type === "Literal" ||
    node.arguments[0].type === "StringLiteral"
  ) {
    return node.arguments[0].value;
  }

  if (node.arguments[0].type === "TemplateLiteral") {
    return node.arguments[0].quasis[0].value.raw;
  }
}

function extractDependencyFromMainRequire(node) {
  return node.arguments[0].value;
}

const ts = (content) => {
  return tsGeneral(content, false);
};

const tsx = (content) => {
  return tsGeneral(content, true);
};

const isObject = (value) => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

const walk = (source, perNode, isTSX = true) => {
  const ast = parse(source, {
    errorOnUnknownASTType: false,
    allowHashBang: true,
    sourceType: "module",
    jsx: isTSX,
  });

  traverse(ast, perNode);
};

// Whether or not the node represents a require function call
const isRequire = (node) => {
  return isPlainRequire(node) || isMainScopedRequire(node);
};

// Whether or not the node represents a plain require function call [require(...)]
const isPlainRequire = (node) => {
  if (!node) return false;

  const c = node.callee;

  return (
    c &&
    node.type === "CallExpression" &&
    c.type === "Identifier" &&
    c.name === "require"
  );
};

// Whether or not the node represents main-scoped require function call [require.main.require(...)]
const isMainScopedRequire = (node) => {
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
