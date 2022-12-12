const fs = require("fs");
const path = require("path");

const fileStr: string = fs.readFileSync(path.join(process.cwd(), "tests/file.json"), "utf8");

module.exports = () => {
  console.log(JSON.stringify(JSON.parse(fileStr)));
};
