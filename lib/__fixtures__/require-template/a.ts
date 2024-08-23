const { hello } = require(`./b`);
const { world } = require(String.raw`./c`);

console.log(hello() + ' ' + world())
