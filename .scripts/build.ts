/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import { fork } from "node:child_process";
import { parse } from "./deps/jsonc";
import { rimraf } from "./deps/rimraf";
import { getPackageRoot } from "./deps/package";
import { transform } from "./xnr/esm/index";
import dedent from "dedent";

const SHOULD_BUILD_CLI = true;
const SHOULD_BUILD_LIB = true;

type TSConfig = {
  compilerOptions: {
    [args: string]: unknown;
  };
  [args: string]: unknown;
};

const transformCliFile = async (filePath: string): Promise<string> => {
  // store hashbang
  let hashbang = "#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings";
  let file = await fs.readFile(filePath, "utf8");
  if (file.startsWith("#!")) {
    const index = file.indexOf("\n") + 1;
    hashbang = file.slice(0, index);
    file = file.slice(index);
  }
  // transform from ts to js
  file = await transform(file);
  // redirect lib import
  file = file.replace("../lib/index", "./esm/index.js");
  // re-add hashbang
  return hashbang + "\n" + file;
};

const main = async () => {
  const projectRoot = await getPackageRoot();
  const fileContent = await fs.readFile(path.join(projectRoot, "tsconfig.json"), "utf8");
  const tsConfig = parse<TSConfig>(fileContent);

  const tsc = async (config: TSConfig) => {
    config.compilerOptions.noEmit = false;

    await fs.writeFile(path.join(projectRoot, "tsconfig.tmp.json"), JSON.stringify(config));

    return new Promise<void>((resolve, reject) => {
      const child = fork("./node_modules/.bin/tsc", ["--project", "tsconfig.tmp.json"], {
        cwd: projectRoot,
      });
      child.on("exit", async (code) => {
        await fs.unlink(path.join(projectRoot, "tsconfig.tmp.json"));
        if (code) {
          reject(new Error(`Error code: ${code}`));
        } else {
          resolve();
        }
      });
    });
  };

  await rimraf(path.join(projectRoot, "dist"));

  if (SHOULD_BUILD_LIB) {
    await tsc({
      ...tsConfig,
      compilerOptions: {
        ...tsConfig.compilerOptions,
        outDir: "dist/esm",
      },
      include: ["lib/**/*"],
    });

    await fs.rm("./dist/cjs", { recursive: true, force: true });
    await fs.mkdir("./dist/cjs", { recursive: true });
    await fs.writeFile("./dist/cjs/index.d.ts", await fs.readFile("./dist/esm/index.d.ts"));
    await fs.writeFile(
      "./dist/cjs/index.cjs",
      dedent`
        let xnr;
        export const transform = async (...args) => {
          if (xnr === undefined) {
            xnr = await import("../esm/index.js")
          }
          return xnr.transform(...args);
        };
        export const build = async (...args) => {
          if (xnr === undefined) {
            xnr = await import("../esm/index.js")
          }
          return xnr.build(...args);
        };
        export const run = async (...args) => {
          if (xnr === undefined) {
            xnr = await import("../esm/index.js")
          }
          return xnr.run(...args);
        };
      `
    );
  }

  await fs.writeFile(
    "./jest.js",
    dedent`
      import { transform } from "./dist/esm/index.js";

      /**
       * @type {import('@jest/transform').Transformer}
       */
      const transformer = {
        canInstrument: false,
        process: (inputCode) => {
          return {
            code: inputCode,
          };
        },
        processAsync: async (inputCode, filePath) => {
          return {
            code: await transform(inputCode, filePath),
          };
        },
      };

      export default transformer;
    `
  );

  if (SHOULD_BUILD_CLI) {
    await fs.writeFile("./dist/xnrb.mjs", await transformCliFile("./cli/build.ts"));
    await fs.writeFile("./dist/xnr.mjs", await transformCliFile("./cli/run.ts"));
    await fs.chmod("./dist/xnr.mjs", 0o755);
    await fs.chmod("./dist/xnrb.mjs", 0o755);
  }
};

main().catch((error) => {
  throw error;
});
