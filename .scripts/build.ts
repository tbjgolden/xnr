/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import { fork } from "node:child_process";
import { build } from "esbuild";
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

  if (SHOULD_BUILD_CLI) {
    await Promise.all([
      build({
        entryPoints: ["./cli/build.ts"],
        minify: true,
        bundle: true,
        outfile: "./dist/xnrb",
        platform: "node",
        target: "es2017",
        logLevel: "info",
      }),
      build({
        entryPoints: ["./cli/run.ts"],
        minify: true,
        bundle: true,
        outfile: "./dist/xnr",
        platform: "node",
        target: "es2017",
        logLevel: "info",
      }),
    ]);
    await fs.chmod("./dist/xnrb", 0o755);
    await fs.chmod("./dist/xnrb", 0o755);
  }

  if (SHOULD_BUILD_LIB) {
    await tsc({
      ...tsConfig,
      compilerOptions: {
        ...tsConfig.compilerOptions,
        outDir: "dist/cjs",
        module: "CommonJS",
        moduleResolution: "node",
      },
      include: ["lib/**/*"],
    });

    await fs.rm("./dist/esm", { recursive: true, force: true });
    await fs.mkdir("./dist/esm", { recursive: true });
    await fs.writeFile(
      "./dist/esm/index.d.ts",
      dedent`
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
      "./dist/esm/index.mjs",
      dedent`
        import xnr from "../cjs/index.js";

        export const build = xnr.build;
        export const run = xnr.run;      
      `
    );
  }
};

main().catch((error) => {
  throw error;
});
