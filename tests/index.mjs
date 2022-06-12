import { fork } from "node:child_process";
import { build } from "../lib/index.mjs";
import path from "node:path/posix";
import fs from "node:fs";
import { strict as assert } from "node:assert";

const runNodeScript = async (entryFilePath) => {
  const absoluteEntryFilePath = path.join(process.cwd(), entryFilePath);
  const outputDirectory = path.join(process.cwd(), ".xnrb");
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

const SINGLE = JSON.stringify({ hello: "world" });
const single = async (file) => {
  try {
    assert.equal(await runNodeScript("tests/single/" + file), SINGLE);
    successCount += 1;
  } catch (error) {
    console.error(error);
    console.log(`Tests: ${successCount} passed, 1 failed (single/${file})`);
    process.exit(1);
  }
};

const defaultExport = async (file) => {
  try {
    assert.equal(await runNodeScript("tests/default-export/" + file), "");
    successCount += 1;
  } catch (error) {
    console.error(error);
    console.log(`Tests: ${successCount} passed, 1 failed (default-export/${file})`);
    process.exit(1);
  }
};

const IMPORT_ALL = new Array(6).fill(JSON.stringify({ hello: "world" })).join("\n");
const importAll = async (file) => {
  try {
    assert.equal(await runNodeScript("tests/import-all/" + file), IMPORT_ALL);
    successCount += 1;
  } catch (error) {
    console.error(error);
    console.log(`Tests: ${successCount} passed, 1 failed (import-all/${file})`);
    process.exit(1);
  }
};

const main = async () => {
  const singles = await fs.promises.readdir(path.join(process.cwd(), "tests/single"));
  for (const file of singles) {
    await single(file);
  }
  const defaultExports = await fs.promises.readdir(
    path.join(process.cwd(), "tests/default-export")
  );
  for (const file of defaultExports) {
    await defaultExport(file);
  }
  const importAlls = await fs.promises.readdir(
    path.join(process.cwd(), "tests/import-all")
  );
  for (const file of importAlls) {
    await importAll(file);
  }
  console.log(`Tests: ${successCount} passed`);
};

main();
