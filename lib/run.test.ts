import { run } from "./index.ts";

test("run a file directly (success)", async () => {
  await expect(
    run({
      filePath: "lib/__fixtures__/default-export/cjs1.cjs",
      outputDirectory: "node_modules/.cache/xnr-run-test",
    })
  ).resolves.toBe(0);
});

test("run a file directly (error)", async () => {
  await expect(
    run({
      filePath: "lib/__fixtures__/error-handling/cant-resolve.ts",
      outputDirectory: "node_modules/.cache/xnr-run-test",
    })
  ).resolves.not.toBe(0);
});

test("run a file directly (error finding dir)", async () => {
  await expect(
    run({
      filePath: "lib/__fixtures__/error-handling/cant-resolve-dir.ts",
      outputDirectory: "node_modules/.cache/xnr-run-test",
    })
  ).resolves.not.toBe(0);
});

test("run a file directly (doesn't exist)", async () => {
  await expect(
    run({
      filePath: "lib/__fixtures__/a/b/c",
      outputDirectory: "node_modules/.cache/xnr-run-test",
    })
  ).resolves.not.toBe(0);
});

test("run a file directly (doesn't exist)", async () => {
  await expect(
    run({
      filePath: "lib/__fixtures__/a",
      outputDirectory: "node_modules/.cache/xnr-run-test",
    })
  ).resolves.not.toBe(0);
});

test("run a file directly (success with stdout)", async () => {
  let stdout = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/import-json/cjs1.cjs",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      writeStdout: (out) => {
        stdout += out;
      },
    })
  ).resolves.toBe(0);
  expect(stdout).toBe('{"foo":"bar"}\n');
});

test("run a file directly (runtime error)", async () => {
  let stderr = "";
  const fileRelativePath = "lib/__fixtures__/error-handling/runtime-error.ts";
  await expect(
    run({
      filePath: fileRelativePath,
      outputDirectory: "node_modules/.cache/xnr-run-test",
      writeStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.not.toBe(0);
  const fileAbsolutePath = `${process.cwd()}/${fileRelativePath}`;
  expect(stderr.slice(0, fileAbsolutePath.length + 36)).toBe(
    `${fileAbsolutePath}\nthrow new Error("runtime error");\n^`
  );
});
