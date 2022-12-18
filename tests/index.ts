#!/usr/bin/env node
import { fork } from "node:child_process";
import { build, transform } from "../dist/esm/index.js";
import path from "node:path/posix";
import fs from "node:fs";
import { strict as assert } from "node:assert";
import dedent from "dedent";

const runNodeScript = async (
  entryFilePath: string,
  outputDirectory = path.join(process.cwd(), ".xnrb")
) => {
  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const outputEntryFilePath = await build(absoluteEntryFilePath, outputDirectory);
  if (outputEntryFilePath !== undefined) {
    return new Promise((resolve) => {
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

let successCount = 0;

const test = async (subdir: string, expected: string) => {
  const dirents = await fs.promises.readdir(path.join(process.cwd(), "tests", subdir), {
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
    assert.equal(await runNodeScript(`tests/${subdir}/${file}`), expected);
    successCount += 1;
  }
};

const main = async () => {
  try {
    await test("single", JSON.stringify({ hello: "world" }));
    await test("default-export", "");
    await test("import-all", new Array(6).fill(JSON.stringify({ hello: "world" })).join("\n"));
    await test(
      "resolve",
      `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
        .split(" ")
        .join("\n")
    );
    await test(
      "resolve2",
      `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
        .split(" ")
        .join("\n")
    );
    await test(
      "tsconfig",
      `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts`.split(" ").join("\n")
    );

    await runNodeScript(path.join(process.cwd(), "tests/import-dot/index.test.ts"));
    successCount += 1;

    await runNodeScript(path.join(process.cwd(), "tests/import-dot-index/index.test.ts"));
    successCount += 1;

    await runNodeScript(path.join(process.cwd(), "tests/resolve/mjs.mjs"));
    successCount += 1;

    const output = await transform(dedent`
      export const log = (str: string) => {
        console.log(str);
      };
    `);
    const expected = dedent`
      export const log = (str) => {
        console.log(str);
      };
    `;
    if (output !== expected) {
      console.log(output, expected);
      throw new Error("output !== expected");
    }
    successCount += 1;
  } catch (error) {
    console.error(error);
    console.log(`\nTests: ${successCount} passed, 1 failed`);
    process.exit(1);
  }

  console.log(`\nTests: ${successCount} passed`);
};

main();
