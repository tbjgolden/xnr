import fs from "fs";
import path from "path";

export default () => {
  console.log(
    JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/file.json"), "utf8")))
  );
};
