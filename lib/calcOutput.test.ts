import fsPath from "node:path";

import { calcOutput } from "./calcOutput.ts";
import { createSourceFileTree } from "./createSourceFileTree.ts";

test("calcOutput", async () => {
  expect(calcOutput(createSourceFileTree({ entry: "lib/__fixtures__/import-all/mjs.ts" }))).toEqual(
    {
      entry: fsPath.join("import-all", "mjs.mjs"),
      files: [
        {
          path: fsPath.join("import-all", "mjs.mjs"),
          contents:
            'import d from "../default-export/mjs1.mjs";\nimport e from "../default-export/mjs2.mjs";\nimport f from "../default-export/mjs3.mjs";\nimport {createRequire} from "module";\nconst require = createRequire(import.meta.url);\nconst a = require("../default-export/cjs1.cjs");\nconst b = require("../default-export/cjs2.cjs");\nconst c = require("../default-export/cjs3.cjs");\na();\nb();\nc();\nd();\ne();\nf();\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/import-all/mjs.ts"),
        },
        {
          path: fsPath.join("default-export", "cjs3.cjs"),
          contents:
            'const fs = require("fs");\nconst path = require("path");\nconst fileStr = fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8");\nmodule.exports = () => {\n  console.log(JSON.stringify(JSON.parse(fileStr)));\n};\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/default-export/cjs3.ts"),
        },
        {
          path: fsPath.join("default-export", "cjs2.cjs"),
          contents:
            'const fs = require("fs");\nconst path = require("path");\nmodule.exports = () => {\n  console.log(JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8"))));\n};\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/default-export/cjs2.js"),
        },
        {
          path: fsPath.join("default-export", "cjs1.cjs"),
          contents:
            'const fs = require("fs");\nconst path = require("path");\nmodule.exports = () => {\n  console.log(JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8"))));\n};\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/default-export/cjs1.cjs"),
        },
        {
          path: fsPath.join("default-export", "mjs3.mjs"),
          contents:
            'import fs from "node:fs";\nimport path from "node:path";\nconst fileStr = fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8");\nexport default () => {\n  console.log(JSON.stringify(JSON.parse(fileStr)));\n};\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/default-export/mjs3.tsx"),
        },
        {
          path: fsPath.join("default-export", "mjs2.mjs"),
          contents:
            'import fs from "fs";\nimport path from "path";\nexport default () => {\n  console.log(JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8"))));\n};\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/default-export/mjs2.mjs"),
        },
        {
          path: fsPath.join("default-export", "mjs1.mjs"),
          contents:
            'import fs from "fs";\nimport path from "path";\nexport default () => {\n  console.log(JSON.stringify(JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/file.json"), "utf8"))));\n};\n',
          sourcePath: fsPath.resolve("lib/__fixtures__/default-export/mjs1.js"),
        },
      ],
    }
  );
});
