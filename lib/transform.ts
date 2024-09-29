import fsPath from "node:path";

import { transform as sucraseTransform } from "sucrase";

import { SucraseOptions, XnrError } from "./utils";

/**
 * Transforms an input code string into a Node-friendly ECMAScript Module (ESM) code string.
 *
 * @param {Object} options - The options for transforming the code.
 * @param {string} options.code - The input code as a string.
 * @param {string} [options.filePath] - The path of the file being transformed.
 * @returns {Promise<string>} A promise that resolves with the transformed code.
 */
export const transform = async ({
  code,
  filePath,
  sucraseOptions = {},
}: {
  code: string;
  filePath?: string;
  sucraseOptions?: SucraseOptions;
}): Promise<string> => transformSync({ code, filePath, sucraseOptions });

export const transformSync = ({
  code: inputCode,
  filePath,
  sucraseOptions = {},
}: {
  code: string;
  filePath?: string;
  sucraseOptions?: SucraseOptions;
}): string => {
  const ext = fsPath.extname(filePath ?? "").toLowerCase();
  try {
    const { code } = sucraseTransform(inputCode, {
      filePath,
      transforms: ["typescript", ...(ext.endsWith("ts") ? [] : ["jsx" as const])],
      enableLegacyTypeScriptModuleInterop: false,
      enableLegacyBabel5ModuleInterop: false,
      disableESTransforms: true,
      production: false,
      ...sucraseOptions,
    });
    return code;
  } catch (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Error transforming";
    throw new XnrError(message);
  }
};
