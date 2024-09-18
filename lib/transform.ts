import fsPath from "node:path";

import { transform as sucraseTransform } from "sucrase";

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
}: {
  code: string;
  filePath?: string;
}): Promise<string> => transformSync({ code, filePath });

export const transformSync = ({
  code: inputCode,
  filePath,
}: {
  code: string;
  filePath?: string;
}): string => {
  const ext = fsPath.extname(filePath ?? "").toLowerCase();
  const { code } = sucraseTransform(inputCode, {
    transforms: ["typescript", ...(ext.endsWith("ts") ? [] : ["jsx" as const])],
    jsxPragma: "React.createClass",
    jsxFragmentPragma: "React.Fragment",
    filePath,
    enableLegacyTypeScriptModuleInterop: false,
    enableLegacyBabel5ModuleInterop: false,
    disableESTransforms: true,
    production: false,
  });
  return code;
};
