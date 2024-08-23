import { build, transform, resolveLocalImport } from "./index.ts";

import { fork } from "node:child_process";
import path from "node:path/posix";
import fs from "node:fs";

test("transpile one file of each extension", async () => {
  await testBatch("single", JSON.stringify({ hello: "world" }));
});
test("transpile one file of each extension with a default export", async () => {
  await testBatch("default-export", "");
});
test("transpile each filetype containing imports from every filetype", async () => {
  await testBatch("default-export", "");
});
test("transpile each filetype containing imports from every filetype", async () => {
  await testBatch("import-all", new Array(6).fill(JSON.stringify({ hello: "world" })).join("\n"));
});
test("__dirname, __filename and import.meta.* is what you'd expect", async () => {
  const cjsFilePath = "lib/__fixtures__/import-meta/cjs.ts";
  const [directoryCjs, fileCjs, cwdCjs] = (await runNodeScript(cjsFilePath)).split("\n");
  expect(fileCjs).toBe(cjsFilePath);
  expect(directoryCjs).toBe(path.dirname(cjsFilePath));
  expect(cwdCjs).toBe(process.cwd());

  const mjsFilePath = "lib/__fixtures__/import-meta/mjs.ts";
  const [directoryMjs, fileMjs, cwdMjs, metaUrl, metaDirname, metaFilename] = (
    await runNodeScript(mjsFilePath)
  ).split("\n");
  expect(fileMjs).toBe(mjsFilePath);
  expect(directoryMjs).toBe(path.dirname(mjsFilePath));
  expect(cwdMjs).toBe(process.cwd());
  expect(metaUrl).toBe("file://" + path.resolve(mjsFilePath));
  expect(metaDirname).toBe(path.resolve(path.dirname(mjsFilePath)));
  expect(metaFilename).toBe(path.resolve(mjsFilePath));
});
test("can import json from every filetype", async () => {
  await testBatch("import-json", JSON.stringify({ foo: "bar" }));
});
test("resolution expected order of priority", async () => {
  await testBatch(
    "resolve",
    `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
      .split(" ")
      .join("\n")
  );
  await testBatch(
    "resolve2",
    `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
      .split(" ")
      .join("\n")
  );
});
test("tsconfig support", async () => {
  await testBatch(
    "tsconfig",
    `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts`.split(" ").join("\n")
  );
});
test("error handling", async () => {
  await expect(
    runNodeScript(`lib/__fixtures__/error-handling/cant-resolve.ts`)
  ).rejects.toThrowError(
    `Could not find import:\n  ./not-a-real-file\nfrom:\n  ${process.cwd()}/lib/__fixtures__/error-handling/cant-resolve.ts`
  );

  const syntaxErrorRegex = new RegExp(
    `^${`Error transforming ${process.cwd()}/lib/__fixtures__/error-handling/syntax-error:`.replaceAll(
      /[$()*+.?[\\\]^{|}]/g,
      "\\$&"
    )}`
  );

  await expect(runNodeScript(`lib/__fixtures__/error-handling/syntax-error`)).rejects.toThrowError(
    syntaxErrorRegex
  );
});
test("misc old bugs", async () => {
  expect(
    await runNodeScript(path.join(process.cwd(), "lib/__fixtures__/import-dot/index.test.ts"))
  ).toBe("magic");
  expect(
    await runNodeScript(path.join(process.cwd(), "lib/__fixtures__/import-dot-index/index.test.ts"))
  ).toBe("magic");
  expect(await runNodeScript(path.join(process.cwd(), "lib/__fixtures__/resolve/mjs.mjs"))).toBe(
    `z.ts
z.z.ts
z/index.ts
z.z/index.ts
z/index.ts
z.z/index.ts
z.ts
z.z.ts
z/index.ts
z.z/index.ts
z.ts
z.z.ts`
  );
  expect(
    await runNodeScript(path.join(process.cwd(), "lib/__fixtures__/new-ts-features/index.test.ts"))
  ).toBe("click click i am lorenzo");
});
test("transform", async () => {
  expect(
    await transform(`
    export const log = (str: string) => {
      console.log(str);
    };
  `)
  ).toBe(`
    export const log = (str) => {
      console.log(str);
    };
  `);
});

test("fallthrough | ts | require | no ext", async () => {
  const checkedFilePaths: string[] = [];
  expect(() => {
    resolveLocalImport({
      importedFrom: "/package/a.ts",
      type: "require",
      absImportPath: "/package/z",
      rawImportPath: "./z",
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.cts",
    "/package/z/index.cjs",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z.cts",
    "/package/z.cjs",
    "/package/z.ts",
    "/package/z.tsx",
    "/package/z.js",
    "/package/z.jsx",
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.ts",
    "/package/z.js/index.cts",
    "/package/z.js/index.cjs",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.mts",
    "/package/z/index.mjs",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.cts",
    "/package/z/index.cjs",
    "/package/z.mts",
    "/package/z.mjs",
    "/package/z.ts",
    "/package/z.tsx",
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.ts",
    "/package/z.js/index.mts",
    "/package/z.js/index.mjs",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z",
    "/package/z/index.cjs",
    "/package/z/index.cts",
    "/package/z/index.js",
    "/package/z/index.jsx",
    "/package/z/index.ts",
    "/package/z/index.tsx",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
      },
    });
  }).toThrow();
  expect(checkedFilePaths).toEqual([
    "/package/z.js",
    "/package/z.js/index.cjs",
    "/package/z.js/index.cts",
    "/package/z.js/index.js",
    "/package/z.js/index.jsx",
    "/package/z.js/index.ts",
    "/package/z.js/index.tsx",
    "/package/z.cjs",
    "/package/z.cts",
    "/package/z.js",
    "/package/z.jsx",
    "/package/z.ts",
    "/package/z.tsx",
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
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
      checkFile: (filePath) => {
        checkedFilePaths.push(filePath);
        return false;
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

// Test helpers

const runNodeScript = async (entryFilePath: string): Promise<string> => {
  const outputDirectory = path.join(process.cwd(), "node_modules/.cache/xnr");

  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const { entrypoint } = await build(absoluteEntryFilePath, outputDirectory);
  return new Promise<string>((resolve) => {
    const child = fork(entrypoint, [], { stdio: "pipe" });
    let stdout = "";
    child.stdout?.on("data", (data) => {
      stdout += data;
    });
    child.stderr?.on("data", (data) => {
      stdout += data;
    });
    child.on("exit", async () => {
      await fs.promises.rm(outputDirectory, { recursive: true, force: true });
      resolve(stdout.trim());
    });
  });
};

const testBatch = async (subdir: string, expected: string) => {
  const dirents = await fs.promises.readdir(path.join(process.cwd(), "lib/__fixtures__", subdir), {
    withFileTypes: true,
  });

  const files = dirents
    .filter((dirent) => {
      return dirent.isFile() && !dirent.name.endsWith(".json");
    })
    .map((dirent) => {
      return dirent.name;
    });
  for (const file of files) {
    expect(await runNodeScript(`lib/__fixtures__/${subdir}/${file}`)).toEqual(expected);
  }
};
