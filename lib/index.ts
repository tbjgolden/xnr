import fs from "node:fs";
import fsPath from "node:path";
import process from "node:process";

import spawn from "nano-spawn";
import { v4 as uuid } from "uuid";

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
  onWriteStdout?: (message: string) => void;
  onWriteStderr?: (message: string) => void;
};

const defaultOnWriteStdout = process.stdout.write.bind(process.stdout);
const defaultOnWriteStderr = process.stderr.write.bind(process.stderr);

/**
 * Runs a file with auto-transpilation of it and its dependencies, as required.
 *
 * @param {string|RunConfig} filePathOrConfig - The path of the file to run or a configuration object.
 * @param {string} [filePath] - (or [config.filePath]) The path of the file to run.
 * @param {string[]} [config.args] - Arguments to pass to the script.
 * @param {string[]} [config.nodeArgs] - Node.js arguments to pass when running the script.
 * @param {string} [config.outputDirectory] - Directory for storing output files.
 * @param {Function} [config.onWriteStdout] - Function to handle standard output.
 * @param {Function} [config.onWriteStderr] - Function to handle standard error output.
 * @returns {Promise<number>} A promise that resolves with the exit code of the process.
 */
export const run = async (filePathOrConfig: string | RunConfig): Promise<number> => {
  const {
    filePath,
    args = [],
    nodeArgs = [],
    outputDirectory: outputDirectory_ = undefined,
    onWriteStdout = defaultOnWriteStdout,
    onWriteStderr = defaultOnWriteStderr,
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
      const outputNamespaceDirectory = packageRootPath
        ? fsPath.join(packageRootPath, "node_modules/.xnr")
        : fsPath.resolve(".tmp/xnr");
      outputDirectory = fsPath.resolve(outputNamespaceDirectory, (uuid as () => string)());
      fs.mkdirSync(outputDirectory, { recursive: true });
    }
  }

  return new Promise<number>((resolve) => {
    void (async () => {
      const cleanupSync = () => {
        fs.rmSync(outputDirectory, { recursive: true, force: true });
      };

      try {
        const { entry } = await build({ filePath, outputDirectory });

        try {
          const child = spawn("node", [...nodeArgs, entry, ...args], {
            stdio: ["inherit", "pipe", "pipe"],
          });

          await Promise.all([
            (async () => {
              for await (const data of child.stdout) {
                onWriteStdout(
                  (onWriteStdout === defaultOnWriteStdout ? data : stripAnsi(data)) + "\n"
                );
              }
            })(),
            (async () => {
              for await (const data of child.stderr) {
                onWriteStderr(
                  (onWriteStderr === defaultOnWriteStderr ? data : stripAnsi(data)) + "\n"
                );
              }
            })(),
            child,
          ]);

          cleanupSync();
          resolve(0);
        } catch (error) {
          cleanupSync();
          resolve(
            error instanceof Error && "code" in error && typeof error.code === "number"
              ? error.code
              : 1
          );
        }
      } catch (error) {
        if (error instanceof XnrError) {
          onWriteStderr(error.message);
          onWriteStderr("\n");
        } else {
          /* istanbul ignore next */
          if (error instanceof Error) {
            /* istanbul ignore next */ {
              onWriteStderr(
                "Unexpected error when running xnr\nIf you are on the latest version, please report this issue on GitHub\n"
              );
              onWriteStderr(error.stack ?? error.message);
              onWriteStderr("\n");
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
