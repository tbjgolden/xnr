#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import { getPackageRoot } from "./deps/package";

const commentRegex = /"files\.exclude":\s*{[^/}]*?\/\//g;

const main = async () => {
  const packageRoot = await getPackageRoot();

  let vsCodeSettings: string;
  try {
    vsCodeSettings = await fs.readFile(
      path.join(packageRoot, ".vscode", "settings.json"),
      "utf8"
    );
  } catch {
    throw new Error("Expected .vscode/settings.json to exist");
  }

  const hasCommentInFilesExclude = commentRegex.test(vsCodeSettings);

  if (hasCommentInFilesExclude) {
    console.error(
      new Error(
        "Found comments in .vscode/settings.json.\nUncomment these lines before committing.\nTo permanently remove from git remove the whole line."
      )
    );
    process.exit(1);
  }
};

main();
