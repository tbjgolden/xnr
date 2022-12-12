/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import { fork } from "node:child_process";
import { parse } from "./deps/jsonc";
import { rimraf } from "./deps/rimraf";
import { getPackageRoot } from "./deps/package";
import dedent from "dedent";

const SHOULD_BUILD_CLI = true;
const SHOULD_BUILD_LIB = true;

type TSConfig = {
  compilerOptions: {
    [args: string]: unknown;
  };
  [args: string]: unknown;
};

const main = async () => {
  const projectRoot = await getPackageRoot();
  const fileContent = await fs.readFile(path.join(projectRoot, "tsconfig.json"), "utf8");
  const tsConfig = parse<TSConfig>(fileContent);

  const tsc = async (config: TSConfig) => {
    config.compilerOptions.noEmit = false;

    await fs.writeFile(
      path.join(projectRoot, "tsconfig.tmp.json"),
      JSON.stringify(config)
    );

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
    await fs.writeFile(
      "./dist/cjs/index.d.ts",
      dedent`
        /**
         * Convert an input code string to a node-friendly esm code string
         */
        export declare const transform: (
          inputCode: string,
          filePath?: string | undefined
        ) => Promise<string>;
        /**
         * Convert source code from an entry file into a directory of node-friendly esm code
         */
        export declare const build: (
          entryFilePath: string,
          outputDirectory?: string | undefined
        ) => Promise<string | undefined>;
        /**
         * Runs a file, no questions asked (auto-transpiling it and its dependencies as required)
         */
        export declare const run: (
          entryFilePath: string,
          args?: string[],
          outputDirectory?: string | undefined
        ) => Promise<void>;
      `
    );
    await fs.writeFile(
      "./dist/cjs/index.cjs",
      dedent`
        let xnr = undefined;
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

  if (SHOULD_BUILD_CLI) {
    await fs.writeFile(
      "./dist/xnrb.mjs",
      `#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
import { build } from "./esm/index.js";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> build entryFile.ts [outDir?= .xnr]");
  process.exit(1);
} else {
  const [fileToRun, outputDirectory] = args;
  build(fileToRun, outputDirectory);
}
`
    );
    await fs.writeFile(
      "./dist/xnr.mjs",
      `#!/usr/bin/env -S node --experimental-import-meta-resolve --no-warnings
import { run } from "./esm/index.js";
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("$> run fileToRun.js");
  process.exit(1);
} else {
  const [fileToRun, ...scriptArgs] = args;
  run(fileToRun, scriptArgs);
}
`
    );

    await fs.chmod("./dist/xnr.mjs", 0o755);
    await fs.chmod("./dist/xnrb.mjs", 0o755);
  }
};

main().catch((error) => {
  throw error;
});
