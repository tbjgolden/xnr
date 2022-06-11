/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { prompt } from "enquirer";
import { validate } from "./deps/npmName";
import { rimraf } from "./deps/rimraf";
import { getPackageRoot } from "./deps/package";

const escapeRegExp = (str: string): string => {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&"); // $& means the whole matched string
};

const currentName = "just-run";

const main = async () => {
  const projectRoot = await getPackageRoot();

  const directoryName = projectRoot.slice(path.dirname(projectRoot).length + 1);
  let initial: string | undefined = validate(directoryName).valid
    ? directoryName
    : undefined;
  let result: string | undefined;
  let validateResult: ReturnType<typeof validate> | undefined;

  do {
    if (validateResult !== undefined) {
      for (const error of validateResult.errors) {
        console.log("  - " + error);
      }
    }

    const { value } = await prompt<{ value: string }>({
      type: "input",
      name: "value",
      message: "npm package name?",
      initial,
    });
    initial = undefined;
    result = value.trim();
    validateResult = validate(result);
  } while (!validateResult.valid || result.includes("/"));

  const stdout = execSync(
    `git status --short | grep '^?' | cut -d\\  -f2- && git ls-files`
  ).toString();

  const files = stdout.split("\n").filter((p: string) => {
    if (p === "") return false;
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });

  const re = new RegExp(escapeRegExp("just-run"), "g");
  for (const filePath of files) {
    fs.writeFileSync(filePath, fs.readFileSync(filePath, "utf8").replace(re, result));
  }

  try {
    // should only run on first name
    if (currentName === `npm${"-"}lib${"-"}name`) {
      await rimraf(path.join(projectRoot, ".git"));
      execSync(
        "git init && git add . && git commit -m 'Initial commit from just-build'",
        {
          cwd: projectRoot,
        }
      );
      console.log("New git repo created");
      execSync("npx husky install", {
        cwd: projectRoot,
      });
      console.log("Husky git hooks installed");
    }
  } catch {
    //
  }
};

main().catch((error) => {
  throw error;
});
