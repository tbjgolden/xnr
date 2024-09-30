import fsPath from "node:path";

import { calcOutput, Output } from "./calcOutput";
import { createSourceFileTree } from "./createSourceFileTree";
import { SucraseOptions } from "./utils";

export { type Output } from "./calcOutput";
export { run, type RunConfig } from "./run";
export { transform } from "./transform";

/**
 * Converts all local source code starting from an entry file into a runnable array of Node.js compatible file contents.
 *
 * @param {Object} options - The options for transpiling the code.
 * @param {string} options.filePath - The path of the entry file.
 * @returns {Promise<Output>} A promise that resolves with the output files and their contents, with an entrypoint.
 */
export const transpile = async ({
  filePath,
  getSucraseOptions = () => ({}),
}: {
  filePath: string;
  getSucraseOptions?: (absFilePath: string) => SucraseOptions;
}): Promise<Output> => {
  const entry = fsPath.resolve(filePath);
  const sourceFileTree = createSourceFileTree({ entry, getSucraseOptions });
  return calcOutput(sourceFileTree);
};
