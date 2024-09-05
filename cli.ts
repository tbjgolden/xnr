#!/usr/bin/env node
import { build, run } from "./lib/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ParsedArgs = {
  command: string | undefined;
  filePath: string | undefined;
  outputDirectory: string | undefined;
  args: string[];
  nodeArgs: string[];
};

// Helper function to parse arguments
function parseArgs(): ParsedArgs {
  const result: ParsedArgs = {
    command: undefined,
    filePath: undefined,
    outputDirectory: undefined,
    args: [],
    nodeArgs: [],
  };

  let args = process.argv.slice(2);

  // --nodeargs
  let nodeArgsFlagIndex = args.indexOf("--nodeargs");
  if (nodeArgsFlagIndex !== -1) {
    let hyphenHyphenIndex = args.indexOf("--", nodeArgsFlagIndex);
    if (hyphenHyphenIndex === -1) hyphenHyphenIndex = args.length;
    result.nodeArgs = args.slice(nodeArgsFlagIndex + 1, hyphenHyphenIndex);
    if (!result.nodeArgs[0]?.startsWith("-")) {
      console.error(
        `Error: Expected --nodeargs args to start with '-', found '${result.nodeArgs[0]}'.`
      );
      console.error("Run 'xnr --help' for usage information.");
      process.exit;
    }
    args = [...args.slice(0, nodeArgsFlagIndex), ...args.slice(hyphenHyphenIndex + 1)];
  }

  // --outdir
  let outputDirectoryFlagIndex = args.indexOf("--outdir");
  if (outputDirectoryFlagIndex !== -1) {
    result.outputDirectory = args[outputDirectoryFlagIndex + 1];
    args = [
      ...args.slice(0, outputDirectoryFlagIndex),
      ...args.slice(outputDirectoryFlagIndex + 2),
    ];
  }

  if (args.length === 1) {
  }

  const commandOrFilePath = args.shift();
  if (commandOrFilePath === "run" || commandOrFilePath === "build") {
    result.command = commandOrFilePath;
    result.filePath = args.shift();
  } else if (commandOrFilePath?.startsWith("-")) {
    console.error(`Error: Found unknown arg '${result.command}'.`);
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  } else {
    result.command = "run";
    result.filePath = commandOrFilePath;
  }
  if (result.command === "build" && !result.outputDirectory) {
    result.outputDirectory = args.shift();
  }
  result.args = args;

  return result;
}

// Handle the build command
async function handleBuild({ filePath, outputDirectory }: ParsedArgs) {
  if (!filePath) {
    console.error("Error: You must specify <filePath> for the 'build' command.");
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  }
  if (filePath.startsWith("-")) {
    console.error(`Error: Unexpected flag '${filePath}'.`);
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  }
  if (!outputDirectory) {
    console.error("Error: You must specify <outputDirectory> for the 'build' command.");
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  }
  if (outputDirectory.startsWith("-")) {
    console.error(`Error: Unexpected flag '${filePath}'.`);
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  }

  try {
    const result = await build({ filePath, outputDirectory });
    console.log(
      `Build completed with ${result.files.length} file${
        result.files.length === 1 ? "" : "s"
      }. Run with:`
    );
    console.log(`  node '${path.relative(process.cwd(), result.entrypoint)}'`);
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// Handle the run command
async function handleRun({ filePath, outputDirectory, args, nodeArgs }: ParsedArgs) {
  if (!filePath) {
    console.error("Error: You must specify <filePath> for the 'run' command.");
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  }
  if (filePath.startsWith("-")) {
    console.error(`Error: Unexpected flag '${filePath}'.`);
    console.error("Run 'xnr --help' for usage information.");
    process.exit(1);
  }

  try {
    const exitCode = await run({ filePath, outputDirectory, args, nodeArgs });
    process.exit(exitCode);
  } catch (error) {
    console.error("Run failed:", error);
    process.exit(1);
  }
}

// Main function to dispatch commands
async function main() {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    let dirname = __dirname;
    while (dirname !== "/") {
      if (fs.existsSync(path.join(dirname, "package.json"))) break;
      dirname = path.dirname(dirname);
    }
    const pkgJson = JSON.parse(fs.readFileSync(path.join(dirname, "package.json"), "utf8"));
    console.log(`xnr v${pkgJson.version}`);
    process.exit(0);
  }

  if (process.argv.includes("--help") || process.argv.includes("-h") || process.argv.length === 2) {
    console.log(
      "Usage: xnr [command (default: run)] [...]" +
        "\n" +
        "\nCommands:" +
        "\n  run <filePath> [args...]" +
        "\n" +
        "\n    Available options for run:" +
        "\n      --outdir ./outDir" +
        "\n      --nodeargs '--inspect' '--max-old-space-size=4096' --" +
        "\n          (use -- to indicate end of list)" +
        "\n" +
        "\n  build <filePath> <outputDirectory>" +
        "\n" +
        "\n     Available options for build:" +
        "\n       --outdir ./outDir  (required if not specified as the second argument)" +
        ""
    );
    process.exit(0);
  }

  const inputArgs = parseArgs();
  if (inputArgs.command === "build") {
    await handleBuild(inputArgs);
  } else if (inputArgs.command === "run") {
    await handleRun(inputArgs);
  } else {
    console.error(`Error: Unknown command '${inputArgs.command}'.`);
    process.exit(1);
  }
}

main();
