/* eslint-disable security/detect-non-literal-fs-filename */

// TODO: remove these when releasing a version that fixes this issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { build, transform } from ".";

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

// Test helpers

const runNodeScript = async (
  entryFilePath: string,
  outputDirectory = path.join(process.cwd(), ".xnrb")
): Promise<string> => {
  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const outputEntryFilePath = await build(absoluteEntryFilePath, outputDirectory);
  if (outputEntryFilePath === undefined) {
    throw new Error("outputEntryFilePath is undefined");
  } else {
    return new Promise<string>((resolve) => {
      const child = fork(outputEntryFilePath, [], { stdio: "pipe" });
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
  }
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
