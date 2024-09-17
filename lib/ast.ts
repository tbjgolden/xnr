import { AnyNode, Literal } from "acorn";
import { findNodeAt } from "acorn-walk";

export const getStringNodeValue = (node: AnyNode | null | undefined): string | undefined => {
  if (node) {
    if (node.type === "Literal" && typeof node.value === "string") {
      return node.value;
    }
    if (node.type === "TemplateLiteral") {
      return node.quasis[0].value.cooked ?? undefined;
    }
    if (
      node.type === "TaggedTemplateExpression" &&
      node.tag.type === "MemberExpression" &&
      node.tag.object.type === "Identifier" &&
      node.tag.object.name === "String" &&
      node.tag.property.type === "Identifier" &&
      node.tag.property.name === "raw"
    ) {
      return node.quasi.quasis[0].value.cooked ?? undefined;
    }
  }
};

export const replaceNode = (nodeToReplace: AnyNode, replacement: AnyNode): void => {
  for (const key of Object.keys(nodeToReplace)) {
    delete nodeToReplace[key as keyof AnyNode];
  }
  Object.assign(nodeToReplace, replacement);
};

export const asLiteral = (value: string): Literal & { value: string; raw: string } => {
  return { type: "Literal", value, raw: JSON.stringify(value), start: -1, end: -1 };
};

export const isCreateRequire = (node: AnyNode) => {
  return Boolean(
    node &&
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "Identifier" &&
      node.callee.name === "createRequire"
  );
};

export const isRequire = (node: AnyNode) => {
  return Boolean(
    node &&
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "Identifier" &&
      node.callee.name === "require"
  );
};

export const isRequireMainRequire = (node: AnyNode) => {
  return Boolean(
    node &&
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "MemberExpression" &&
      node.callee.object.object.type === "Identifier" &&
      node.callee.object.object.name === "require" &&
      node.callee.object.property.type === "Identifier" &&
      node.callee.object.property.name === "main" &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === "require"
  );
};

export const isNodeStringLiteral = (
  node: AnyNode | null | undefined
): node is Literal & { value: string; raw: string } => {
  return node
    ? node.type === "Literal" && typeof node.value === "string" && typeof node.raw === "string"
    : false;
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

export const determineModuleTypeFromAST = (ast: AnyNode) => {
  return findNodeAt(ast, undefined, undefined, (nodeType) =>
    MODULE_ONLY_NODE_TYPE_SET.has(nodeType)
  )
    ? ".mjs"
    : ".cjs";
};
