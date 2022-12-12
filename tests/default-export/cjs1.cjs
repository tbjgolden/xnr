const fs = require("fs");
const path = require("path");

module.exports = () => {
  console.log(
    JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/file.json"), "utf8")))
  );
};
