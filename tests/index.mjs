import { fork } from "node:child_process";
import { build } from "../lib/index.mjs";
import path from "node:path/posix";
import fs from "node:fs";
import { strict as assert } from "node:assert";

const runNodeScript = async (
  entryFilePath,
  outputDirectory = path.join(process.cwd(), ".xnrb")
) => {
  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const outputEntryFilePath = await build(absoluteEntryFilePath, outputDirectory);
  return new Promise((resolve) => {
    const child = fork(outputEntryFilePath, [], { stdio: "pipe" });
    let stdout = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stdout += data;
    });
    child.on("exit", async () => {
      await fs.promises.rm(outputDirectory, { recursive: true, force: true });
      resolve(stdout.trim());
    });
  });
};

let successCount = 0;

const test = async (subdir, expected) => {
  const files = (
    await fs.promises.readdir(path.join(process.cwd(), "tests", subdir), {
      withFileTypes: true,
    })
  )
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name);
  for (const file of files) {
    assert.equal(await runNodeScript(`tests/${subdir}/${file}`), expected);
    successCount += 1;
  }
};

const main = async () => {
  try {
    await test("single", JSON.stringify({ hello: "world" }));
    await test("default-export", "");
    await test(
      "import-all",
      new Array(6).fill(JSON.stringify({ hello: "world" })).join("\n")
    );
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

    console.log("-----\n\n");
    await runNodeScript(
      path.join(process.cwd(), "tests/resolve/mjs.mjs"),
      "xnr-test-dir"
    );
    successCount += 1;
  } catch (error) {
    console.error(error);
    console.log(`Tests: ${successCount} passed, 1 failed`);
    process.exit(1);
  }

  console.log(`Tests: ${successCount} passed`);
};

main();
