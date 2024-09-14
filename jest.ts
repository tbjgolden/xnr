import type { Transformer } from "@jest/transform";

import { transform } from "./lib/index.js";

const transformer: Transformer = {
  canInstrument: false,
  process: (inputCode) => ({ code: inputCode }),
  processAsync: async (inputCode, filePath) => {
    return { code: await transform({ code: inputCode, filePath }) };
  },
};

export default transformer;
