import fs from 'node:fs/promises';
import path from 'node:path';
export const getPackageRoot = async () => {
  let directory = process.cwd();
  do {
    try {
      const stats = await fs.stat(path.join(directory, "package.json"));
      if (stats.isFile()) {
        break;
      }
    } catch {}
    directory = path.dirname(directory);
  } while (directory !== "/");
  if (directory === "/") {
    throw new Error("package directory not found");
  }
  return directory;
};
