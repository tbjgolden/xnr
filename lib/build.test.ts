import { fork } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import fsPath from "node:path";
import process from "node:process";

import { build, run } from "./index.ts";

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
test("can import json from every filetype", async () => {
  await testBatch("import-json", JSON.stringify({ foo: "bar" }));
});
test("resolution expected order of priority", async () => {
  await testBatch(
    "resolve",
    `z/index.ts z.z/index.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
      .split(" ")
      .join("\n")
  );
  await testBatch(
    "resolve2",
    `z/index.ts z.z/index.ts z/index.ts z.z/index.ts z/index.ts z.z/index.ts z.ts z.z.ts z/index.ts z.z/index.ts z.ts z.z.ts`
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
test("error handling stderr", async () => {
  try {
    await runNodeScript(`lib/__fixtures__/error-handling/cant-resolve.ts`);
    expect("didThrow").toBe(true);
  } catch (error) {
    if (error instanceof Error) {
      expect(error.message).toMatch(`Could not find import:\n  ./not-a-real-file`);
      expect(error.message).toMatch(`from:\n  lib/__fixtures__/error-handling/cant-resolve.ts`);
    } else {
      expect("didThrowError").toBe(true);
    }
  }
});
test("error handling syntax error", async () => {
  const syntaxErrorRegex = new RegExp(
    `^${`Error transforming ${process.cwd()}/lib/__fixtures__/error-handling/syntax-error:`.replaceAll(
      /[$()*+.?[\\\]^{|}]/g,
      String.raw`\$&`
    )}`
  );

  await expect(runNodeScript(`lib/__fixtures__/error-handling/syntax-error`)).rejects.toThrowError(
    syntaxErrorRegex
  );
});
test("supports import * as x from", async () => {
  expect(await runNodeScript("lib/__fixtures__/import-star/a.ts")).toBe(
    '{"b":{"a":"a","b":"b","c":"c"}}'
  );
});
test("supports export from", async () => {
  expect(await runNodeScript("lib/__fixtures__/export-from/a.ts")).toBe("hello");
});
test("supports require(`...`)", async () => {
  expect(await runNodeScript("lib/__fixtures__/require-template/a.ts")).toBe("'hello world'");
});
test("supports require main require", async () => {
  expect(await runNodeScript("lib/__fixtures__/require-main-require/a.ts")).toBe("world");
});
test("handles symlink", async () => {
  expect(await runNodeScript("lib/__fixtures__/symlink/a.cjs")).toBe("e.cjs");
});
test("handles external deps", async () => {
  expect(await runNodeScript("lib/__fixtures__/external-dep/a.mjs")).toBe("{}");
  expect(await runNodeScript("lib/__fixtures__/external-dep/b.cjs")).toBe("{}");
  expect(await runNodeScript("lib/__fixtures__/external-dep/c.ts")).toMatch("hello world!");
  // Node runtime error
  expect(await runNodeScript("lib/__fixtures__/external-dep/unresolvable.mjs")).toMatch(
    "ERR_MODULE_NOT_FOUND"
  );
});
test("in tmpdir outside ts project", async () => {
  const entryPath = fsPath.resolve(tmpdir(), "xnr-run-test/test.ts");
  const entryDirectory = fsPath.join(entryPath, "..");
  await fs.rm(entryDirectory, { recursive: true, force: true });
  await fs.mkdir(entryDirectory, { recursive: true });
  await fs.writeFile(entryPath, 'console.log("test" as string);');
  expect(await runNodeScript(entryPath)).toBe("test");
  await fs.rm(entryDirectory, { recursive: true, force: true });
});
test("import dot", async () => {
  expect(await runNodeScript("lib/__fixtures__/import-dot/index.test.ts")).toBe("magic");
});
test("import dot index", async () => {
  expect(await runNodeScript("lib/__fixtures__/import-dot-index/index.test.ts")).toBe("magic");
});
test("new ts features", async () => {
  expect(
    await runNodeScript(
      fsPath.join(process.cwd(), "lib/__fixtures__/new-ts-features/index.test.ts")
    )
  ).toBe("click click i am lorenzo");
});
test("default run dir", async () => {
  // this has to be in build.test instead of run.test to avoid a race condition
  await expect(run("lib/__fixtures__/new-ts-features/index.ts")).resolves.toBe(0);
});

const runNodeScript = async (entryFilePath: string): Promise<string> => {
  const outputDirectory = fsPath.join(process.cwd(), "node_modules/.cache/xnr");

  const absoluteEntryFilePath = fsPath.resolve(entryFilePath);
  const { entry } = await build({
    filePath: absoluteEntryFilePath,
    outputDirectory,
  });
  return new Promise<string>((resolve) => {
    const child = fork(entry, [], { stdio: "pipe" });
    let stdout = "";
    child.stdout?.on("data", (data) => {
      stdout += data;
    });
    child.stderr?.on("data", (data) => {
      stdout += data;
    });
    child.on("exit", () => {
      void fs.rm(outputDirectory, { recursive: true, force: true }).then(() => {
        resolve(stdout.trim());
      });
    });
  });
};

const testBatch = async (subdir: string, expected: string) => {
  const dirents = await fs.readdir(fsPath.join(process.cwd(), "lib/__fixtures__", subdir), {
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
