import { randomUUID } from "node:crypto";
import fsPath from "node:path";
import { fileURLToPath } from "node:url";

import { AnyNode, AssignmentProperty, Program, VariableDeclaration } from "acorn";
import { ancestor } from "acorn-walk";
import { generate } from "astring";
import { resolve as importResolve } from "import-meta-resolve";

import { determineModuleType, Method, prettyPath, XnrError } from "./newHelpers";
import {
  asLiteral,
  getStringNodeValue,
  isCreateRequire,
  isNodeStringLiteral,
  isRequire,
  isRequireMainRequire,
  replaceNode,
} from "./shared";

type LocalDependency = {
  method: Method;
  raw: string;
  file: SourceFileNode;
};

type SourceFileNode = {
  path: string;
  ast: Program;
  localDependencies: LocalDependency[];
};

export type OutputFile = {
  path: string;
  contents: string;
  sourcePath: string;
};

/**
 * Represents the result of the build process, including the entry point and processed files.
 * @property {string} entry - The entry point file for the build.
 * @property {OutputFile[]} files - An array of file paths and their contents from the build process.
 */
export type Output = {
  entry: string;
  files: OutputFile[];
};

export const calcOutput = (sourceFileTree: SourceFileNode): Output => {
  const closestCommonRootPath = getClosestCommonRootPath(sourceFileTree);

  const absOutputFiles: OutputFile[] = [];

  const processFile = (file: SourceFileNode, absOutputFilePath: string): string => {
    const importPathMap = new Map<string, string>();
    for (const localDependency of file.localDependencies) {
      const absDepOutputFilePath = processFile(
        localDependency.file,
        getAbsoluteOutputPathFromDependency(localDependency)
      );
      importPathMap.set(
        localDependency.raw,
        getRelativeNodeImportPath(absOutputFilePath, absDepOutputFilePath)
      );
    }
    const contents = calcFileOutput({ file, importPathMap });
    absOutputFiles.push({ path: absOutputFilePath, contents, sourcePath: file.path });
    return absOutputFilePath;
  };

  processFile(sourceFileTree, getAbsoluteOutputPath(sourceFileTree.path));
  absOutputFiles.reverse();

  const files = absOutputFiles.map(({ path, ...rest }) => ({
    path: path.slice(closestCommonRootPath.length),
    ...rest,
  }));

  return {
    entry: files[0].path,
    files,
  };
};

export const getAbsoluteOutputPath = (absInputPath: string): string => {
  return getAbsoluteOutputPathFromDependency({
    method: determineModuleType(absInputPath),
    file: { path: absInputPath },
  });
};

const getAbsoluteOutputPathFromDependency = <T extends { method: Method; file: { path: string } }>(
  dependency: T
) => {
  return `${dependency.file.path.slice(
    0,
    dependency.file.path.length - fsPath.extname(dependency.file.path).length
  )}${dependency.method === "import" ? ".mjs" : ".cjs"}`;
};

const getRelativeNodeImportPath = (absFromFilePath: string, absDepOutputFilePath: string) => {
  let relativePath = fsPath.relative(fsPath.dirname(absFromFilePath), absDepOutputFilePath);
  if (fsPath.sep !== "/") {
    relativePath = relativePath.replaceAll(fsPath.sep, "/");
  }
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }
  return relativePath;
};

const getClosestCommonRootPath = (sourceFileNode: SourceFileNode): string => {
  const getNestedLocalDependencies = (sourceFileNode: SourceFileNode): string[] => [
    sourceFileNode.path,
    ...sourceFileNode.localDependencies.flatMap((localDependency) =>
      getNestedLocalDependencies(localDependency.file)
    ),
  ];

  const [firstDep, ...otherDeps] = getNestedLocalDependencies(sourceFileNode);
  let potentialCommonRootPath = fsPath.dirname(firstDep) + fsPath.sep;
  while (otherDeps.some((dep) => !dep.startsWith(potentialCommonRootPath))) {
    const nextPotentialCommonRootPath = fsPath.dirname(potentialCommonRootPath) + fsPath.sep;
    if (nextPotentialCommonRootPath === potentialCommonRootPath) {
      throw new XnrError(`Could not find a common root path for local dependencies`);
    }
    potentialCommonRootPath = nextPotentialCommonRootPath;
  }

  return potentialCommonRootPath;
};

const calcFileOutput = ({
  file,
  importPathMap,
}: {
  file: SourceFileNode;
  importPathMap: Map<string, string>;
}): string => {
  const rewriteSourceString = (toRewrite: AnyNode | null | undefined) => {
    const value = getStringNodeValue(toRewrite);
    if (toRewrite && value) {
      const localDependency = importPathMap.get(value);
      if (localDependency) {
        replaceNode(toRewrite, asLiteral(localDependency));
      }
    }
  };
  const rewriteNodeWithSource = (node: { source?: AnyNode | null | undefined }) => {
    rewriteSourceString(node.source);
  };
  const rewriteNodeWithSourceAsFirstArg = (node: { arguments?: AnyNode[] }) => {
    const arg = node.arguments?.[0];
    rewriteSourceString(arg);
  };

  ancestor(file.ast, {
    ImportExpression: rewriteNodeWithSource,
    ImportDeclaration(node, _, ancestors) {
      const parent = ancestors.at(-2) as AnyNode | undefined;
      if (isNodeStringLiteral(node.source) && parent && parent.type === "Program") {
        const defaultImport = node.specifiers.find((node) => node.type === "ImportDefaultSpecifier")
          ?.local?.name;
        const namedImports = node.specifiers
          .filter((node) => node.type === "ImportSpecifier")
          .map((node): [string | undefined, string] => {
            return [
              node.imported.type === "Identifier" ? node.imported.name : getStringNodeValue(node),
              node.local.name,
            ];
          })
          .filter((value): value is [string, string] => value[0] !== undefined);

        const localDependency = importPathMap.get(node.source.value);

        if (localDependency && namedImports.length > 0) {
          const getDependencyEntryFilePath = () => {
            let dependencyEntryFilePath: string;

            try {
              const fileUrl = importResolve(localDependency, "file://" + file.path);
              dependencyEntryFilePath = fileURLToPath(fileUrl);
            } catch {
              throw new XnrError(
                `Could not import ${JSON.stringify(localDependency)} from ${prettyPath(file.path)}`
              );
            }

            return dependencyEntryFilePath;
          };

          const dependencyModuleType = determineModuleType(getDependencyEntryFilePath());

          if (dependencyModuleType === "require") {
            const uniqueID = defaultImport ?? `xnr_${randomUUID().slice(-12)}`;

            const cjs: VariableDeclaration = {
              type: "VariableDeclaration",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: {
                    type: "ObjectPattern",
                    properties: namedImports.map(
                      ([key, value]: [string, string]): AssignmentProperty => {
                        return {
                          type: "Property",
                          key: { type: "Identifier", name: key, start: -1, end: -1 },
                          computed: false,
                          value: { type: "Identifier", name: value, start: -1, end: -1 },
                          kind: "init",
                          method: false,
                          shorthand: key === value,
                          start: -1,
                          end: -1,
                        };
                      }
                    ),
                    start: -1,
                    end: -1,
                  },
                  init: { type: "Identifier", name: uniqueID, start: -1, end: -1 },
                  start: -1,
                  end: -1,
                },
              ],
              kind: "const",
              start: -1,
              end: -1,
            };

            node.specifiers = [
              {
                type: "ImportDefaultSpecifier",
                local: { type: "Identifier", name: uniqueID, start: -1, end: -1 },
                start: -1,
                end: -1,
              },
            ];

            parent.body.splice(parent.body.indexOf(node) + 1, 0, cjs);
          }
        }

        if (localDependency) {
          node.source = asLiteral(localDependency);
        }
      }
    },
    ExportNamedDeclaration: rewriteNodeWithSource,
    ExportAllDeclaration: rewriteNodeWithSource,
    CallExpression(node) {
      if (isCreateRequire(node)) {
        node.arguments = [
          {
            type: "MemberExpression",
            object: {
              type: "MetaProperty",
              meta: { type: "Identifier", name: "import", start: -1, end: -1 },
              property: { type: "Identifier", name: "meta", start: -1, end: -1 },
              start: -1,
              end: -1,
            },
            property: { type: "Identifier", name: "url", start: -1, end: -1 },
            computed: false,
            optional: false,
            start: -1,
            end: -1,
          },
        ];
      } else if (isRequire(node)) {
        rewriteNodeWithSourceAsFirstArg(node);
      } else if (isRequireMainRequire(node)) {
        const value = getStringNodeValue(node.arguments[0]);
        if (value) {
          const localDependency = importPathMap.get(value);
          if (localDependency) {
            node.arguments[0] = asLiteral(localDependency);
          }
        }
      }
    },
  });

  return generate(file.ast);
};
