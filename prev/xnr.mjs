#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
import { run } from "./esm/index.js";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> run fileToRun.js");
  process.exit(1);
} else {
  const [fileToRun, ...scriptArgs] = args;
  run(fileToRun, scriptArgs);
}
