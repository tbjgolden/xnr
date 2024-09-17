import d from "../default-export/mjs1.js";
import e from "../default-export/mjs2.mjs";
import f from "../default-export/mjs3.ts";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const a = require("../default-export/cjs1.cjs");
const b = require("../default-export/cjs2.js");
const c = require("../default-export/cjs3.ts");

a();
b();
c();
d();
e();
f();
