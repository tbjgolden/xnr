import { readFile, writeFile, rm, mkdir, chmod } from "node:fs/promises";
import { spawn } from "node:child_process";
import { checkDirectory, readJSON } from "./lib/utils";
import { rollup, RollupBuild } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

checkDirectory();

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

type TSConfig = {
  compilerOptions: { [args: string]: unknown };
  exclude?: string[];
  [args: string]: unknown;
};
const tsconfigJson = readJSON<TSConfig>(await readFile("tsconfig.json", "utf8"));
const buildTsconfig: TSConfig = {
  ...tsconfigJson,
  exclude: [...(tsconfigJson.exclude ?? []), "**/*.test.ts"],
  compilerOptions: {
    ...tsconfigJson.compilerOptions,
    allowImportingTsExtensions: false,
    noEmit: false,
  },
};
await writeFile("tsconfig.tmp.json", JSON.stringify(buildTsconfig));
await new Promise<void>((resolve, reject) => {
  const child = spawn("npx", ["tsc", "--project", "tsconfig.tmp.json"]);
  child.stdout.on("data", (data) => {
    console.log(data.toString());
  });
  child.stderr.on("data", (data) => {
    console.error(data.toString());
  });
  child.on("exit", async (code) => {
    if (code) {
      reject(new Error(`Error code: ${code}`));
    } else {
      resolve();
    }
  });
});
await rm("tsconfig.tmp.json");

// ---

let bundle: RollupBuild | undefined;
let buildFailed = false;
try {
  // create a bundle
  bundle = await rollup({
    input: "dist/cli/run.js",
    external: [/^node:/],
    plugins: [nodeResolve(), commonjs(), terser({})],
    onwarn: () => {
      // ignore
    },
  });

  const { output } = await bundle.generate({ format: "es" });
  await writeFile("dist/xnr", output[0].code);
  await chmod("dist/xnr", 0o755);
} catch (error) {
  buildFailed = true;
  // do some error reporting
  console.error(error);
}
if (bundle) {
  // closes the bundle
  await bundle.close();
}
process.exit(buildFailed ? 1 : 0);
