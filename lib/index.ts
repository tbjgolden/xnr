import { spawn } from "node:child_process";
import fs from "node:fs";
import fsPath from "node:path";
import process from "node:process";

import { calcOutput, Output } from "./calcOutput";
import { createSourceFileTree } from "./createSourceFileTree";
import { XnrError } from "./utils";

export { type Output } from "./calcOutput";
export { transform } from "./transform";

/**
 * Converts all local source code starting from an entry file into a runnable array of Node.js compatible file contents.
 *
 * @param {Object} options - The options for transpiling the code.
 * @param {string} options.filePath - The path of the entry file.
 * @returns {Promise<Output>} A promise that resolves with the output files and their contents, with an entrypoint.
 */
export const transpile = async ({ filePath }: { filePath: string }): Promise<Output> => {
  const entrypoint = fsPath.resolve(filePath);
  const sourceFileTree = createSourceFileTree(entrypoint);
  return calcOutput(sourceFileTree);
};

/**
 * Converts all local source code starting from an entry file into a directly runnable directory of Node.js compatible code.
 *
 * @param {Object} options - The options for building the code.
 * @param {string} options.filePath - The path of the entry file.
 * @param {string} options.outputDirectory - The directory where the output files will be saved.
 * @returns {Promise<Output>} A promise that resolves with the output files and their contents, with an entrypoint.
 */
export const build = async ({
  filePath,
  outputDirectory,
}: {
  filePath: string;
  outputDirectory: string;
}): Promise<Output> => {
  const { entry, files } = await transpile({ filePath });

  outputDirectory = fsPath.resolve(outputDirectory);
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const { path, contents } of files) {
    const absPath = fsPath.join(outputDirectory, path);
    const dirname = fsPath.dirname(absPath);
    fs.mkdirSync(dirname, { recursive: true });
    fs.writeFileSync(absPath, contents);
  }

  return { entry: fsPath.resolve(outputDirectory, entry), files };
};

export type RunConfig = {
  filePath: string;
  args?: string[];
  nodeArgs?: string[];
  outputDirectory?: string | undefined;
  writeStdout?: (message: string) => void;
  writeStderr?: (message: string) => void;
};

/**
 * Runs a file with auto-transpilation of it and its dependencies, as required.
 *
 * @param {string|RunConfig} filePathOrConfig - The path of the file to run or a configuration object.
 * @param {string} [filePathOrConfig.filePath] - The path of the file to run.
 * @param {string[]} [filePathOrConfig.args] - Arguments to pass to the script.
 * @param {string[]} [filePathOrConfig.nodeArgs] - Node.js arguments to pass when running the script.
 * @param {string} [filePathOrConfig.outputDirectory] - Directory for storing output files.
 * @param {Function} [filePathOrConfig.writeStdout] - Function to handle standard output.
 * @param {Function} [filePathOrConfig.writeStderr] - Function to handle standard error output.
 * @returns {Promise<number>} A promise that resolves with the exit code of the process.
 */
export const run = async (filePathOrConfig: string | RunConfig): Promise<number> => {
  const {
    filePath,
    args = [],
    nodeArgs = [],
    outputDirectory: outputDirectory_ = undefined,
    writeStdout = process.stdout.write.bind(process.stdout),
    writeStderr = process.stderr.write.bind(process.stderr),
  } = typeof filePathOrConfig === "string" ? { filePath: filePathOrConfig } : filePathOrConfig;

  let outputDirectory: string;
  {
    if (outputDirectory_) {
      outputDirectory = fsPath.resolve(outputDirectory_);
    } else {
      let current = fsPath.resolve(filePath);
      let packageRootPath: string | undefined;
      while (true) {
        const packageJsonPath_ = fsPath.join(current, "package.json");
        if (fs.existsSync(packageJsonPath_)) {
          packageRootPath = fsPath.dirname(packageJsonPath_);
          break;
        }
        const nextCurrent = fsPath.dirname(current);
        if (nextCurrent === current) {
          break;
        }
        current = nextCurrent;
      }
      outputDirectory = packageRootPath
        ? fsPath.join(packageRootPath, "node_modules/.cache/xnr")
        : fsPath.resolve(".tmp/xnr");
    }
  }

  const cleanupSync = () => {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  };

  return new Promise<number>((resolve) => {
    void (async () => {
      try {
        const { entry, files } = await build({ filePath, outputDirectory });

        const outputDirectoryErrorLocationRegex = new RegExp(
          `(${`${outputDirectory}${fsPath.sep}`.replaceAll(
            /[$()*+.?[\\\]^{|}]/g,
            String.raw`\$&`
          )}[^:\n]*)(?::\\d+){0,2}`,
          "g"
        );

        const outputToInputFileLookup = new Map<string, string>();
        for (const { path: relativeOutputPath, sourcePath } of files) {
          outputToInputFileLookup.set(
            fsPath.resolve(outputDirectory, relativeOutputPath),
            sourcePath
          );
        }

        const randomBytes = "&nT@r" + "9F2Td";

        const transformErrors = (str: string) => {
          if (str.includes(outputDirectory)) {
            // Replaces output file paths with input file paths
            for (const match of [...str.matchAll(outputDirectoryErrorLocationRegex)].reverse()) {
              const file = match[1];
              const inputFile = outputToInputFileLookup.get(file);
              if (inputFile) {
                const nextPartStartIndex = match.index + match[0].length;
                str = `${str.slice(0, match.index ?? 0)}${inputFile}${randomBytes}${str.slice(
                  nextPartStartIndex
                )}`;
              }
            }

            // Removes the parts of the stack trace that are constant to all xnr runs
            const inLines = str.split("\n");
            const outLines = [];

            let hasFoundFirstSourceFile = false;
            for (let i = inLines.length - 1; i >= 0; i--) {
              const inLine = inLines[i];
              if (hasFoundFirstSourceFile) {
                outLines.push(inLine);
              } else {
                if (inLine.startsWith("    at ")) {
                  if (inLine.includes(randomBytes)) {
                    hasFoundFirstSourceFile = true;
                    outLines.push(inLine);
                  }
                } else {
                  outLines.push(inLine);
                }
              }
            }
            str = outLines.reverse().join("\n").replaceAll(randomBytes, "");
          }

          return str;
        };

        process.on("SIGINT", cleanupSync); // CTRL+C
        process.on("SIGQUIT", cleanupSync); // Keyboard quit
        process.on("SIGTERM", cleanupSync); // `kill` command
        const child = spawn("node", [...nodeArgs, entry, ...args], {
          stdio: [
            // stdin
            "inherit",
            // stdout
            "pipe",
            // stderr
            "pipe",
          ],
        });

        child.stdout.on("data", (data: Buffer) => {
          writeStdout(stripAnsi(data.toString()));
        });
        child.stderr.on("data", (data: Buffer) => {
          writeStderr(transformErrors(stripAnsi(data.toString())) + "\n");
        });

        child.on("exit", (code: number | null) => {
          process.off("SIGINT", cleanupSync); // CTRL+C
          process.off("SIGQUIT", cleanupSync); // Keyboard quit
          process.off("SIGTERM", cleanupSync); // `kill` command
          cleanupSync();
          resolve(code ?? 0);
        });
      } catch (error) {
        if (error instanceof XnrError) {
          writeStderr(error.message);
          writeStderr("\n");
        } else {
          /* istanbul ignore next */
          if (error instanceof Error) {
            /* istanbul ignore next */ {
              writeStderr(
                "Unexpected error when running xnr\nIf you are on the latest version, please report this issue on GitHub\n"
              );
              writeStderr(error.stack ?? error.message);
              writeStderr("\n");
            }
          }
        }
        cleanupSync();
        resolve(1);
      }
    })();
  });
};

const stripAnsi = (string: string) => {
  return string.replaceAll(
    // eslint-disable-next-line no-control-regex
    /\u001B\[\d+m/g,
    ""
  );
};

export { XnrError } from "./utils";
