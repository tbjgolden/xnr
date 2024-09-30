import fs from "node:fs";
import fsPath from "node:path";

import { Output } from "./calcOutput";
import { transpile } from "./transpile";
import { SucraseOptions } from "./utils";

export { type Output } from "./calcOutput";
export { run, type RunConfig } from "./run";
export { transform } from "./transform";

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
  getSucraseOptions = () => ({}),
}: {
  filePath: string;
  outputDirectory: string;
  getSucraseOptions?: (absFilePath: string) => SucraseOptions;
}): Promise<Output> => {
  const { entry, files, packages } = await transpile({ filePath, getSucraseOptions });

  outputDirectory = fsPath.resolve(outputDirectory);
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const { path, contents } of files) {
    const absPath = fsPath.join(outputDirectory, path);
    const dirname = fsPath.dirname(absPath);
    fs.mkdirSync(dirname, { recursive: true });
    fs.writeFileSync(absPath, contents);
  }

  return { entry: fsPath.resolve(outputDirectory, entry), files, packages };
};
