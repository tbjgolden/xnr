import c from "./c.mjs";

const b = require("./b.cjs");

type A = {
  a: string;
  "import.meta.url": string;
};

const a: A = {
  a: "a",
  "import.meta.url": import.meta.url,
};

export default a;
