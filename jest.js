import { transform } from "./dist/lib/index.js";

/**
 * @type {import('@jest/transform').Transformer}
 */
const transformer = {
  canInstrument: false,
  process: (inputCode) => {
    return {
      code: inputCode,
    };
  },
  processAsync: async (inputCode, filePath) => {
    return {
      code: await transform(inputCode, filePath),
    };
  },
};

export default transformer;
