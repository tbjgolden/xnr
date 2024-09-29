import { createSourceFileTree } from "./createSourceFileTree.ts";

const removeAst = <T extends { ast: unknown; localDependencies: { file: T }[] }>(
  sourceFileTree: T
): Omit<T, "ast"> => {
  const { ast: _, ...rest } = sourceFileTree;
  return {
    ...rest,
    localDependencies: sourceFileTree.localDependencies.map((localDependency) => ({
      ...localDependency,
      file: removeAst(localDependency.file),
    })),
  };
};
const removePath = <T extends { path: unknown; localDependencies: { file: T }[] }>(
  sourceFileTree: T
): Omit<T, "path"> => {
  const { path: _, ...rest } = sourceFileTree;
  return {
    ...rest,
    localDependencies: sourceFileTree.localDependencies.map((localDependency) => ({
      ...localDependency,
      file: removePath(localDependency.file),
    })),
  };
};

test("createSourceFileTree", async () => {
  expect(
    removePath(removeAst(createSourceFileTree({ entry: "lib/__fixtures__/import-all/mjs.ts" })))
  ).toEqual({
    localDependencies: [
      { method: "import", raw: "../default-export/mjs1.js", file: { localDependencies: [] } },
      { method: "import", raw: "../default-export/mjs2.mjs", file: { localDependencies: [] } },
      { method: "import", raw: "../default-export/mjs3.js", file: { localDependencies: [] } },
      { method: "require", raw: "../default-export/cjs1.cjs", file: { localDependencies: [] } },
      { method: "require", raw: "../default-export/cjs2.js", file: { localDependencies: [] } },
      { method: "require", raw: "../default-export/cjs3", file: { localDependencies: [] } },
    ],
  });
});
