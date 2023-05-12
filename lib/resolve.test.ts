/* eslint-disable security/detect-non-literal-fs-filename */

// TODO: remove these when releasing a version that fixes this issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { resolveLocalImport } from "./resolve.ts";

test("fallthrough | ts | require | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".ts",
      type: "require",
      absImportPath: "/package/z",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.cts",
    "/package/z/index.d.cts",
    "/package/z/index.cjs",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.d.ts",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z.cts",
    "/package/z.d.cts",
    "/package/z.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
    "/package/z.js",
    "/package/z.jsx",
  ]);
});

test("fallthrough | ts | require | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".ts",
      type: "require",
      absImportPath: "/package/z.js",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z.ts",
    "/package/z.js/index.cts",
    "/package/z.js/index.d.cts",
    "/package/z.js/index.cjs",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.d.ts",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.d.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | ts | import  | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".ts",
      type: "import",
      absImportPath: "/package/z",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.mts",
    "/package/z/index.d.mts",
    "/package/z/index.mjs",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.d.ts",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.cts",
    "/package/z/index.d.cts",
    "/package/z/index.cjs",
    "/package/z.mts",
    "/package/z.d.mts",
    "/package/z.mjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.d.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | ts | import  | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".ts",
      type: "import",
      absImportPath: "/package/z.js",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z.ts",
    "/package/z.js/index.mts",
    "/package/z.js/index.d.mts",
    "/package/z.js/index.mjs",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.d.ts",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.cts",
    "/package/z.js/index.d.cts",
    "/package/z.js/index.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
    "/package/z.mts",
    "/package/z.d.mts",
    "/package/z.mjs",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.cts",
    "/package/z.d.cts",
    "/package/z.cjs",
  ]);
});

test("fallthrough | js | require | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".js",
      type: "require",
      absImportPath: "/package/z",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.cjs",
    "/package/z/index.cts",
    "/package/z/index.d.cts",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.d.ts",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.d.cts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
  ]);
});

test("fallthrough | js | require | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".js",
      type: "require",
      absImportPath: "/package/z.js",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z.js",
    "/package/z.js/index.cjs",
    "/package/z.js/index.cts",
    "/package/z.js/index.d.cts",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.d.ts",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.d.cts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
  ]);
});

test("fallthrough | js | import  | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".js",
      type: "import",
      absImportPath: "/package/z",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.mjs",
    "/package/z/index.mts",
    "/package/z/index.d.mts",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.d.ts",
    "/package/z/index.cjs",
    "/package/z/index.cts",
    "/package/z/index.d.cts",
    "/package/z.mjs",
    "/package/z.mts",
    "/package/z.d.mts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.d.cts",
  ]);
});

test("fallthrough | js | import  | yes ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(
    resolveLocalImport({
      parentExt: ".js",
      type: "import",
      absImportPath: "/package/z.js",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    })
  ).toBe(undefined);
  expect(checkedFilePaths).toEqual([
    "/package/z.js",
    "/package/z.js/index.mjs",
    "/package/z.js/index.mts",
    "/package/z.js/index.d.mts",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.d.ts",
    "/package/z.js/index.cjs",
    "/package/z.js/index.cts",
    "/package/z.js/index.d.cts",
    "/package/z.mjs",
    "/package/z.mts",
    "/package/z.d.mts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.d.ts",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.d.cts",
  ]);
});
