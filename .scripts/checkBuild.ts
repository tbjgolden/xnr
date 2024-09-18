#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import fsPath from "node:path";
import { pathToFileURL } from "node:url";

import { checkDirectory, getPackageJson, isFile } from "./lib/utils";

await checkDirectory();

const packageJson = await getPackageJson();

{
  console.log("validating cli...");
  const binEntries = Object.entries(packageJson.bin ?? {});
  if (binEntries.length !== 1 || binEntries[0][0] !== "xnr") {
    console.log("expected xnr to be in the bin field");
    process.exit(1);
  }
  const [_, cliFilePath] = binEntries[0];
  if (cliFilePath) {
    let isCliPathAFile: boolean;
    try {
      isCliPathAFile = await isFile(cliFilePath);
    } catch {
      isCliPathAFile = false;
    }
    if (!isCliPathAFile) {
      console.log(`"xnr": "${cliFilePath}" is not an executable file`);
      process.exit(1);
    }
    // validate run
    {
      const command = `${cliFilePath} ./.scripts/build-tests`;
      const stdout = execSync(`node ${`${cliFilePath} ./.scripts/build-tests`}`).toString();
      const expected = `hello world\n{ hello: 'world' }\n`;
      if (stdout !== expected) {
        console.log(`unexpected response when running: ${command}\n`);
        console.log("expected:");
        console.log(JSON.stringify(expected));
        console.log("actual:");
        console.log(JSON.stringify(stdout));
        process.exit(1);
      }
      {
        const { code, messages } = await new Promise<{
          code: number | null;
          messages: { type: "stdout" | "stderr"; data: string }[];
        }>((resolve) => {
          const messages: { type: "stdout" | "stderr"; data: string }[] = [];
          const child = spawn("node", [cliFilePath, ".scripts/build-tests/crash-test.ts"]);
          child.stdout.on("data", (data: string | Buffer) => {
            messages.push({ type: "stdout", data: data.toString() });
          });
          child.stderr.on("data", (data: string | Buffer) => {
            messages.push({ type: "stderr", data: data.toString() });
          });
          child.on("exit", (code) => {
            resolve({
              code,
              messages,
            });
          });
        });

        if (code !== 1) {
          console.log(`Expected exit code to be 1, was ${code}`);
          process.exit(1);
        }
        if (messages[0]?.type !== "stdout" || messages[0]?.data !== "log\n") {
          console.log(`Expected first log to be to stdout with "log\\n"`);
          console.log(messages[0].data);
          process.exit(1);
        }

        const expected = pathToFileURL(
          fsPath.resolve("node_modules/.cache/xnr/crash-test.mjs")
        ).toString();
        if (
          messages[1]?.type !== "stderr" ||
          !(messages[1]?.data ?? "").split("\n")[0].startsWith(expected)
        ) {
          console.log("Expected to contain:");
          console.log(expected);
          console.log("Found:");
          console.log((messages[1]?.data ?? "").split("\n")[0]);
          process.exit(1);
        }
      }
    }
    // validate build
    {
      const command = `${cliFilePath} build ./.scripts/build-tests build-tests`;
      const stdout = execSync(`node ${command}`).toString();
      const expected = `Build completed with 3 files. Run with:\n  node 'build-tests${fsPath.sep}index.mjs'\n`;
      if (stdout !== expected) {
        console.log(`unexpected response when running: ${command}\n`);
        console.log("expected:");
        console.log(JSON.stringify(expected));
        console.log("actual:");
        console.log(JSON.stringify(stdout));
        rmSync("./build-tests", { recursive: true, force: true });
        process.exit(1);
      }
      rmSync("./build-tests", { recursive: true, force: true });
    }
    // validate help
    {
      const command = `${cliFilePath} -h`;
      const stdout = execSync(`node ${command}`).toString();
      const expected = "Usage: xnr";
      if (!stdout.startsWith(expected)) {
        console.log(`unexpected response when running: ${command}\n`);
        console.log("expected to start with:");
        console.log(JSON.stringify(expected));
        console.log("actual:");
        console.log(JSON.stringify(stdout));
        rmSync("./build-tests", { recursive: true, force: true });
        process.exit(1);
      }
      rmSync("./build-tests", { recursive: true, force: true });
    }
    // validate version
    {
      const command = `${cliFilePath} --version`;
      const stdout = execSync(`node ${command}`).toString();
      const expected = "xnr v";
      if (!stdout.startsWith(expected)) {
        console.log(`unexpected response when running: ${command}\n`);
        console.log("expected to start with:");
        console.log(JSON.stringify(expected));
        console.log("actual:");
        console.log(JSON.stringify(stdout));
        rmSync("./build-tests", { recursive: true, force: true });
        process.exit(1);
      }
      rmSync("./build-tests", { recursive: true, force: true });
    }

    console.log(`validated 'npx xnr'`);
  }
}

{
  console.log("validating api...");
  if (typeof packageJson.exports !== "object") {
    console.log("package.json exports field must be an object");
    process.exit(1);
  }

  const libEntry = packageJson.exports["."];
  if (typeof libEntry === "string") {
    if (!(await isFile(libEntry))) {
      console.log(`entrypoint file "${libEntry}" doesn't exist`);
      process.exit(1);
    }
    const { transform } = (await import(pathToFileURL(fsPath.resolve(libEntry)).toString())) as {
      transform: (args: { code: string }) => Promise<string>;
    };
    const result = await transform({
      code: `const typedFn = (str: string) => console.log(str);\ntypedFn("hello world");`,
    });
    const expected = 'const typedFn = (str) => console.log(str);\ntypedFn("hello world");';
    if (result !== expected) {
      console.log("expected:");
      console.log(JSON.stringify(expected));
      console.log("actual:");
      console.log(JSON.stringify(result));
      process.exit(1);
    }
    console.log(`validated main lib export`);
  } else {
    console.log("package.json exports field must have a string value for the '.' key");
    process.exit(1);
  }

  console.log("validating jest...");
  const jestEntry = packageJson.exports["./jest"];
  if (typeof jestEntry === "string") {
    if (!(await isFile(jestEntry))) {
      console.log(`entrypoint file "${jestEntry}" doesn't exist`);
      process.exit(1);
    }
    const { default: transformer } = (await import(
      pathToFileURL(fsPath.resolve(jestEntry)).toString()
    )) as {
      default: { processAsync: (code: string, filename: string) => Promise<{ code: string }> };
    };
    const processResult = await transformer.processAsync(
      `const typedFn = (str: string) => console.log(str);\ntypedFn("hello world");`,
      "a.ts"
    );
    const result = processResult.code;
    const expected = 'const typedFn = (str) => console.log(str);\ntypedFn("hello world");';
    if (result !== expected) {
      console.log("expected:");
      console.log(JSON.stringify(expected));
      console.log("actual:");
      console.log(JSON.stringify(result));
      process.exit(1);
    }
    console.log(`validated jest export`);
  } else {
    console.log("package.json exports field must have a string value for the './jest' key");
    process.exit(1);
  }
}
