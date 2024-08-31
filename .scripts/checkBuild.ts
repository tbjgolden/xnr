import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { getPackageJson, checkDirectory, isFile } from "./lib/utils";

checkDirectory();

const packageJson = await getPackageJson();

{
  console.log("validating cli...");
  for (const [cliName, cliFilePath] of Object.entries(packageJson.bin ?? {})) {
    if (cliFilePath) {
      let isCliPathAFile = false;
      try {
        isCliPathAFile = await isFile(cliFilePath);
      } catch {}
      if (!isCliPathAFile) {
        console.log(`"${cliName}": "${cliFilePath}" is not an executable file`);
        process.exit(1);
      }
      if (cliName === "xnr") {
        // validate xnr
        const command = `${cliFilePath} ./.scripts/build-tests`;
        const stdout = execSync(`node ${command}`).toString();
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
            child.stdout.on("data", (data) => {
              messages.push({ type: "stdout", data: data.toString() });
            });
            child.stderr.on("data", (data) => {
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
          if (
            messages[1]?.type !== "stderr" ||
            (messages[1]?.data ?? "").split("\n")[0] !==
              `file://${process.cwd()}/.scripts/build-tests/crash-test.ts`
          ) {
            console.log(
              `Expected second log to be to stderr ending with "build-tests/crash-test.ts"`
            );
            process.exit(1);
          }
        }
      } else if (cliName === "xnrb") {
        const command = `${cliFilePath} ./.scripts/build-tests build-tests`;
        const stdout = execSync(`node ${command}`).toString();
        const expected = "build-tests/index.mjs\n";
        if (stdout !== expected) {
          console.log(`unexpected response when running: ${command}\n`);
          console.log("expected:");
          console.log(JSON.stringify(expected));
          console.log("actual:");
          console.log(JSON.stringify(stdout));
          rmSync("./build-tests", { recursive: true, force: true });
          process.exit(1);
        }
        const command2 = `${cliFilePath} ./.scripts/build-tests`;
        const stdout2 = execSync(`node ${expected.trim()}`).toString();
        const expected2 = "hello world\n{ hello: 'world' }\n";
        if (stdout2 !== expected2) {
          console.log(`unexpected response when running: ${command2}\n`);
          console.log("expected:");
          console.log(JSON.stringify(expected2));
          console.log("actual:");
          console.log(JSON.stringify(stdout2));
          rmSync("./build-tests", { recursive: true, force: true });
          process.exit(1);
        }
        rmSync("./build-tests", { recursive: true, force: true });
      } else {
        throw new Error(`unexpected cli name: ${cliName}`);
      }
      console.log(`validated 'npx ${cliName}'`);
    }
  }
}

{
  console.log("validating api...");

  let entrypoint: string | undefined;
  if (packageJson.exports) {
    if (packageJson.exports.startsWith("./")) {
      entrypoint = packageJson.exports.slice(2);
    } else {
      console.log("package.json exports must start with './'");
      process.exit(1);
    }
  } else if (packageJson.main) {
    entrypoint = packageJson.main;
  } else {
    console.log("package.json exports field or main field must be specified");
    process.exit(1);
  }
  if (!(await isFile(entrypoint))) {
    console.log(`entrypoint file "${entrypoint}" doesn't exist`);
    process.exit(1);
  }
  const { transform } = await import(process.cwd() + "/" + entrypoint);
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
}

{
  console.log("validating portable executable...");
  const result = execSync("dist/xnr lib/__fixtures__/export-from/a.ts").toString();
  const expected = "hello\n";
  if (result !== expected) {
    console.log("expected:");
    console.log(JSON.stringify(expected));
    console.log("actual:");
    console.log(JSON.stringify(result));
    process.exit(1);
  }
}
