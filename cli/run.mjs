#!/usr/bin/env node
/* eslint-disable no-console */

import { run } from "../lib/index.mjs";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("run <fileToRun>");
  process.exit(1);
} else {
  const [fileToRun, ...scriptArgs] = args;
  run(fileToRun, scriptArgs);
}

// build()
