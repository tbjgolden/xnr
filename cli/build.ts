#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
import { build } from "../lib/index";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> xnrb entryFile.ts [outDir?= dist]");
  process.exit(1);
} else {
  const [fileToRun, outputDirectory] = args;
  build(fileToRun, outputDirectory);
}
