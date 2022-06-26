#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
import { run } from "../lib/index";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> run fileToRun.js");
  process.exit(1);
} else {
  const [fileToRun, ...scriptArgs] = args;
  run(fileToRun, scriptArgs).then((code) => {
    process.exit(code);
  });
}
