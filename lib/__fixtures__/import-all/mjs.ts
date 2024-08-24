import { createRequire } from "node:module";
import a from "../default-export/cjs1.cjs";
import b from "../default-export/cjs2.js";
import d from "../default-export/mjs1.js";
import e from "../default-export/mjs2.mjs";
import f from "../default-export/mjs3.js";

const require = createRequire(import.meta.url);
const c = require("../default-export/cjs3");

a();
b();
c();
d();
e();
f();
