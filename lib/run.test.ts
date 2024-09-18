import fsPath from "node:path";

import { run } from "./index.ts";

test("run a file directly (success)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/default-export/cjs1.cjs",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toBe("");
});

test("run a file directly (error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/error-handling/cant-resolve.ts",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(`Could not find import:\n  ./not-a-real-file`);
  expect(stderr).toMatch(
    `from:\n  ${fsPath.join("lib", "__fixtures__", "error-handling", "cant-resolve.ts")}`
  );
});

test("run a file directly (error finding dir)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/error-handling/cant-resolve-dir.ts",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(`Could not find import:\n  ./not-a-real-dir`);
  expect(stderr).toMatch(
    `from:\n  ${fsPath.join("lib", "__fixtures__", "error-handling", "cant-resolve-dir.ts")}`
  );
});

test("run a file directly (file doesn't exist)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/a",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(`Could not find entry:\n  ${fsPath.join("lib", "__fixtures__", "a")}`);
});

test("run a file directly (path doesn't exist)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/a/b/c",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(
    `Could not find entry:\n  ${fsPath.join("lib", "__fixtures__", "a", "b", "c")}`
  );
});

test("run a file directly (success with stdout)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/import-json/cjs1.cjs",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(0);
  expect(stdout).toBe('{"foo":"bar"}\n');
  expect(stderr).toBe("");
});

test("run a file directly (runtime error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/error-handling/runtime-error.ts",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(fsPath.resolve("node_modules/.cache/xnr-run-test/runtime-error.cjs"));
  expect(stderr).toMatch(`throw new Error("runtime error");`);
});
