#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
/* eslint-disable no-console */
import { run } from "../lib/index.js";

const allArgs = process.argv.slice(2);
if (allArgs.length === 0) {
  console.log("$> xnr fileToRun.js");
  process.exit(1);
} else {
  let nodeArgs: string[] = [];
  let scriptArgs: string[] = allArgs;
  if (allArgs.includes("--")) {
    const index = allArgs.indexOf("--");
    nodeArgs = allArgs.slice(0, index);
    scriptArgs = allArgs.slice(index + 1);
  }
  const [filePath, ...args] = scriptArgs;
  const code = await run({ filePath, args, nodeArgs });
  process.exit(code);
}
