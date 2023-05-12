#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
/* eslint-disable no-console */

// TODO: remove these when releasing a version that fixes this issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { run } from "../lib";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> xnr fileToRun.js");
  process.exit(1);
} else {
  const [fileToRun, ...scriptArgs] = args;
  const code = await run(fileToRun, scriptArgs);
  process.exit(code);
}
