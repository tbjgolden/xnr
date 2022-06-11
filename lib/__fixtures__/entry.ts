/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */

import aTS from "./a";
import cMJS from "../c.mjs";
const bCJS = require("./b.cjs");
const fs = require("fs");

console.log({
  aTS,
  bCJS,
  cMJS,
  fs,
});
