import fs from "fs";
import path from "path";

export default () => {
  console.log(
    JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8")))
  );
};
