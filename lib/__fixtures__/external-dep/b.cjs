const { format } = require("prettier")

console.log(format("{\n}", { parser: "json"}))
