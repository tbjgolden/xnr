/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */

import cMJS from "./c.mjs";
const bCJS = require("./b.cjs");
const fs = require("fs");

console.log({
  bCJS,
  cMJS,
  fs,
});
