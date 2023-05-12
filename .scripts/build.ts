import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { readJSON } from "easier-node";
import { checkDirectory } from "./lib/utils";

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
  compilerOptions: { ...tsconfigJson.compilerOptions, noEmit: false },
};
await writeFile("tsconfig.tmp.json", JSON.stringify(buildTsconfig));
await new Promise<void>((resolve, reject) => {
  const child = spawn("npx", ["tsc", "--project", "tsconfig.tmp.json"]);
  child.on("exit", async (code) => {
    if (code) reject(new Error(`Error code: ${code}`));
    else resolve();
  });
});
await rm("tsconfig.tmp.json");
