import { resolveLocalImport } from "./index.ts";

test("fallthrough | ts | require | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.ts",
      type: "require",
      absImportPath: "/package/z",
      rawImportPath: "./z",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.mts",
    "/package/z/index.mjs",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.cts",
    "/package/z/index.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.mts",
    "/package/z.mjs",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | ts | require | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.ts",
      type: "require",
      absImportPath: "/package/z.js",
      rawImportPath: "./z.js",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.ts",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.mts",
    "/package/z.js/index.mjs",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.cts",
    "/package/z.js/index.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | ts | import  | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.ts",
      type: "import",
      absImportPath: "/package/z",
      rawImportPath: "./z",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.mts",
    "/package/z/index.mjs",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.cts",
    "/package/z/index.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.mts",
    "/package/z.mjs",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | ts | import  | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.ts",
      type: "import",
      absImportPath: "/package/z.js",
      rawImportPath: "./z.js",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.ts",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.mts",
    "/package/z.js/index.mjs",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.cts",
    "/package/z.js/index.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.mts",
    "/package/z.mjs",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | js | require | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.js",
      type: "require",
      absImportPath: "/package/z",
      rawImportPath: "./z",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.cjs",
    "/package/z/index.cts",
    "/package/z/index.jsx",
    "/package/z/index.js",
    "/package/z/index.tsx",
    "/package/z/index.ts",
    "/package/z/index.mjs",
    "/package/z/index.mts",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.jsx",
    "/package/z.js",
    "/package/z.tsx",
    "/package/z.ts",
    "/package/z.mjs",
    "/package/z.mts",
  ]);
});

test("fallthrough | js | require | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.js",
      type: "require",
      absImportPath: "/package/z.js",
      rawImportPath: "./z.js",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.js",
    "/package/z.js/index.cjs",
    "/package/z.js/index.cts",
    "/package/z.js/index.jsx",
    "/package/z.js/index.js",
    "/package/z.js/index.tsx",
    "/package/z.js/index.ts",
    "/package/z.js/index.mjs",
    "/package/z.js/index.mts",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.jsx",
    "/package/z.js",
    "/package/z.tsx",
    "/package/z.ts",
    "/package/z.mjs",
    "/package/z.mts",
  ]);
});

test("fallthrough | js | import  | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      type: "import",
      importedFrom: "/package/a.js",
      absImportPath: "/package/z",
      rawImportPath: "./z",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.mjs",
    "/package/z/index.mts",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.cjs",
    "/package/z/index.cts",
    "/package/z.mjs",
    "/package/z.mts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.cjs",
    "/package/z.cts",
  ]);
});

test("fallthrough | js | import  | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      type: "import",
      importedFrom: "/package/a.js",
      absImportPath: "/package/z.js",
      rawImportPath: "./z.js",
      getResolvedFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return undefined;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.js",
    "/package/z.js/index.mjs",
    "/package/z.js/index.mts",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.cjs",
    "/package/z.js/index.cts",
    "/package/z.mjs",
    "/package/z.mts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.cjs",
    "/package/z.cts",
  ]);
});
