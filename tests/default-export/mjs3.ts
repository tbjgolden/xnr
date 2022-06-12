import fs from "fs";
import path from "path";

const fileStr: string = fs.readFileSync(
  path.join(process.cwd(), "tests/file.json"),
  "utf8"
);

export default () => {
  console.log(JSON.stringify(JSON.parse(fileStr)));
};
