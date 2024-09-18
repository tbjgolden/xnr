import { spawn } from "node:child_process";
import fsPath from "node:path";

import { run } from "./index.ts";

test("run a file directly (success)", async () => {
  let stdout = "";
  let stderr = "";
  await expect(
    run({
      filePath: "lib/__fixtures__/default-export/cjs1.cjs",
      outputDirectory: "node_modules/.cache/xnr-run-test",
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
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
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
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
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
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
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
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
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
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
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
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
      writeStdout: (out) => {
        stdout += out;
      },
      writeStderr: (err) => {
        stderr += err;
      },
    })
  ).resolves.toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toMatch(fsPath.join("node_modules", ".cache", "xnr-run-test", "runtime-error.ts"));
  expect(stderr).toMatch(`throw new Error("runtime error");`);
});

test("run allows stdin passthrough", async () => {
  if (process.platform !== "win32") {
    let hasWritten = false;
    let stdout = "";
    await new Promise<void>((resolve) => {
      const child = spawn("xnr", ["lib/__fixtures__/stdin/run-wrapper.ts"], {
        shell: process.platform === "win32",
        stdio: "pipe",
      });
      function write(data: string) {
        if (child.stdin.write(data)) {
          process.nextTick(() => {
            child.stdin.end();
          });
        } else {
          child.stdin.once("drain", () => {
            child.stdin.end();
          });
        }
      }
      child.stdout.on("data", (data) => {
        stdout += data;
        if (stdout.includes("What do you think of Node.js?")) {
          if (!hasWritten) {
            write("yee\n");
          }
          hasWritten = true;
        }
      });
      child.on("close", () => {
        resolve();
      });
    });

    expect(stdout).toMatch("Thank you for your valuable feedback: yee");
  }
});
