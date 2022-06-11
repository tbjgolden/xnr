import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {prompt} from 'enquirer';
import {validate} from './deps/npmName.mjs';
import {rimraf} from './deps/rimraf.mjs';
import {getPackageRoot} from './deps/package.mjs';
const escapeRegExp = str => {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
};
const currentName = "just-run";
const main = async () => {
  const projectRoot = await getPackageRoot();
  const directoryName = projectRoot.slice(path.dirname(projectRoot).length + 1);
  let initial = validate(directoryName).valid ? directoryName : undefined;
  let result;
  let validateResult;
  do {
    if (validateResult !== undefined) {
      for (const error of validateResult.errors) {
        console.log("  - " + error);
      }
    }
    const {value} = await prompt({
      type: "input",
      name: "value",
      message: "npm package name?",
      initial
    });
    initial = undefined;
    result = value.trim();
    validateResult = validate(result);
  } while (!validateResult.valid || result.includes("/"));
  const stdout = execSync(`git status --short | grep '^?' | cut -d\\  -f2- && git ls-files`).toString();
  const files = stdout.split("\n").filter(p => {
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
    if (currentName === `npm${"-"}lib${"-"}name`) {
      await rimraf(path.join(projectRoot, ".git"));
      execSync("git init && git add . && git commit -m 'Initial commit from just-build'", {
        cwd: projectRoot
      });
      console.log("New git repo created");
      execSync("npx husky install", {
        cwd: projectRoot
      });
      console.log("Husky git hooks installed");
    }
  } catch {}
};
main().catch(error => {
  throw error;
});
