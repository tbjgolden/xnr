import fsPath from "node:path";

import { run } from "./index.ts";

test("run a file directly (success)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/default-export/cjs1.cjs",
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

test("run a file directly (dotenv)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/dotenv-test/index.ts",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(0);
  expect(stdout).toBe("value\n");
  expect(stderr).toBe("");
});

test("run a file directly (ansi escape)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/ansi/cyan.cjs",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(0);
  expect(stdout).toBe("I am cyan\n");
  expect(stderr).toBe("");
});

test("run a file directly (dep has js syntax error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/syntax-error/index1.ts",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch("Error transforming");
});

test("run a file directly (dep has ts syntax error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/syntax-error/index2.ts",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch("Error transforming");
});

test("run a file directly (has js syntax error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/syntax-error/js-syntax-error.ts",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch("Error transforming");
});

test("run a file directly (has ts syntax error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/syntax-error/ts-syntax-error.ts",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch("Error transforming");
});

test("run a file directly (runtime error)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/error-handling/runtime-error.ts",
      onWriteStdout: (out) => {
        stdout += out;
      },
      onWriteStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(fsPath.resolve("node_modules/.xnr"));
  expect(stderr).toMatch(`runtime-error.cjs`);
  expect(stderr).toMatch(`throw new Error("runtime error");`);
});
