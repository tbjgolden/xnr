#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
import { build } from "../lib/index.mjs";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> build entryFile.ts [outDir?= .xnr]");
  process.exit(1);
} else {
  const [fileToRun, outputDirectory] = args;
  build(fileToRun, outputDirectory);
}
