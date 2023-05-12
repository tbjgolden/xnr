#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
/* eslint-disable no-console */
import { run } from "../lib/index.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> xnr fileToRun.js");
  process.exit(1);
} else {
  const [fileToRun, ...scriptArgs] = args;
  const code = await run(fileToRun, scriptArgs);
  process.exit(code);
}
