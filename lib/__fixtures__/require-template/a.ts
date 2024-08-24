const { hello } = require(`./b`);
const { world } = require(String.raw`./c`);
const { inspect } = require("node:util")

console.log(inspect(hello() + ' ' + world()))
