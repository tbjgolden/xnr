#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
/* eslint-disable no-console */

// TODO: remove these when releasing a version that fixes this issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { build } from "../lib";
import { relative } from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> xnrb entryFile.ts [outDir?= dist]");
  process.exit(1);
} else {
  const [fileToRun, outputDirectory] = args;
  const entryFile = await build(fileToRun, outputDirectory);
  if (entryFile) {
    console.log(relative(process.cwd(), entryFile));
  }
}
