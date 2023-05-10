const a = require("../default-export/cjs1.cjs");
const b = require("../default-export/cjs2.js");
const c = require("../default-export/cjs3.ts");

Promise.all([
  import("../default-export/mjs1.js"),
  import("../default-export/mjs2.mjs"),
  import("../default-export/mjs3"),
]).then(([d, e, f]): void => {
  a();
  b();
  c();
  d.default();
  e.default();
  f.default();
});
