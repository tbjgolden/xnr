import { build, run } from "./index.ts";

import { fork } from "node:child_process";
import path from "node:path/posix";
import fs from "node:fs";
import process from "node:process";

test("transpile one file of each extension", async () => {
  await testBatch("single", JSON.stringify({ hello: "world" }));
});
test("transpile one file of each extension with a default export", async () => {
  await testBatch("default-export", "");
});
test("transpile each filetype containing imports from every filetype", async () => {
  await testBatch("default-export", "");
});
test("transpile each filetype containing imports from every filetype", async () => {
  await testBatch("import-all", new Array(6).fill(JSON.stringify({ hello: "world" })).join("\n"));
});
test("__dirname, __filename and import.meta.* is what you'd expect", async () => {
  const cjsFilePath = "lib/__fixtures__/import-meta/cjs.ts";
  const [directoryCjs, fileCjs, cwdCjs] = (await runNodeScript(cjsFilePath)).split("\n");
  expect(fileCjs).toBe(cjsFilePath);
  expect(directoryCjs).toBe(path.dirname(cjsFilePath));
  expect(cwdCjs).toBe(process.cwd());

  const mjsFilePath = "lib/__fixtures__/import-meta/mjs.ts";
  const [directoryMjs, fileMjs, cwdMjs, metaUrl, metaDirname, metaFilename] = (
    await runNodeScript(mjsFilePath)
  ).split("\n");
  expect(fileMjs).toBe(mjsFilePath);
  expect(directoryMjs).toBe(path.dirname(mjsFilePath));
  expect(cwdMjs).toBe(process.cwd());
  expect(metaUrl).toBe("file://" + path.resolve(mjsFilePath));
  expect(metaDirname).toBe(path.resolve(path.dirname(mjsFilePath)));
  expect(metaFilename).toBe(path.resolve(mjsFilePath));
});
test("can import json from every filetype", async () => {
  await testBatch("import-json", JSON.stringify({ foo: "bar" }));
});
test("resolution expected order of priority", async () => {
  await testBatch(
    "resolve",
    `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
      .split(" ")
      .join("\n")
  );
  await testBatch(
    "resolve2",
    `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
      .split(" ")
      .join("\n")
  );
});
test("tsconfig support", async () => {
  await testBatch(
    "tsconfig",
    `z.ts z.z.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts`.split(" ").join("\n")
  );
});
test("error handling", async () => {
  await expect(
    runNodeScript(`lib/__fixtures__/error-handling/cant-resolve.ts`)
  ).rejects.toThrowError(
    `Could not find import:\n  ./not-a-real-file\nfrom:\n  ${process.cwd()}/lib/__fixtures__/error-handling/cant-resolve.ts`
  );

  const syntaxErrorRegex = new RegExp(
    `^${`Error transforming ${process.cwd()}/lib/__fixtures__/error-handling/syntax-error:`.replaceAll(
      /[$()*+.?[\\\]^{|}]/g,
      "\\$&"
    )}`
  );

  await expect(runNodeScript(`lib/__fixtures__/error-handling/syntax-error`)).rejects.toThrowError(
    syntaxErrorRegex
  );
});
test("supports export from", async () => {
  expect(await runNodeScript("lib/__fixtures__/export-from/a.ts")).toBe("hello");
});
test("supports require(`...`)", async () => {
  expect(await runNodeScript("lib/__fixtures__/require-template/a.ts")).toBe("hello world");
});
test("supports require main require", async () => {
  expect(await runNodeScript("lib/__fixtures__/require-main-require/a.ts")).toBe("hello");
});
test("misc old bugs", async () => {
  expect(await runNodeScript("lib/__fixtures__/import-dot/index.test.ts")).toBe("magic");
  expect(await runNodeScript("lib/__fixtures__/import-dot-index/index.test.ts")).toBe("magic");
  expect(await runNodeScript("lib/__fixtures__/resolve/mjs.mjs")).toBe(
    `z.ts
z.z.ts
z/index.ts
z.z/index.ts
z/index.ts
z.z/index.ts
z.ts
z.z.ts
z/index.ts
z.z/index.ts
z.ts
z.z.ts`
  );
  expect(
    await runNodeScript(path.join(process.cwd(), "lib/__fixtures__/new-ts-features/index.test.ts"))
  ).toBe("click click i am lorenzo");
  // this has to be in build.test instead of run.test to avoid a race condition
  await expect(run("lib/__fixtures__/new-ts-features/index.ts")).resolves.toBe(0);
});

const runNodeScript = async (entryFilePath: string): Promise<string> => {
  const outputDirectory = path.join(process.cwd(), "node_modules/.cache/xnr");

  const absoluteEntryFilePath = path.resolve(entryFilePath);
  const { entrypoint } = await build(absoluteEntryFilePath, outputDirectory);
  return new Promise<string>((resolve) => {
    const child = fork(entrypoint, [], { stdio: "pipe" });
    let stdout = "";
    child.stdout?.on("data", (data) => {
      stdout += data;
    });
    child.stderr?.on("data", (data) => {
      stdout += data;
    });
    child.on("exit", async () => {
      // await fs.promises.rm(outputDirectory, { recursive: true, force: true });
      resolve(stdout.trim());
    });
  });
};

const testBatch = async (subdir: string, expected: string) => {
  const dirents = await fs.promises.readdir(path.join(process.cwd(), "lib/__fixtures__", subdir), {
    withFileTypes: true,
  });

  const files = dirents
    .filter((dirent) => {
      return dirent.isFile() && !dirent.name.endsWith(".json");
    })
    .map((dirent) => {
      return dirent.name;
    });
  for (const file of files) {
    expect(await runNodeScript(`lib/__fixtures__/${subdir}/${file}`)).toEqual(expected);
  }
};
