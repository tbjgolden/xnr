import fs from "node:fs/promises";
import path from "node:path";

export const rimraf = async (directoryPath: string): Promise<void> => {
  try {
    const files = await fs.readdir(directoryPath, {
      withFileTypes: true,
    });

    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          if (file.isFile()) {
            return fs.unlink(path.join(directoryPath, file.name));
          } else if (file.isDirectory()) {
            return rimraf(path.join(directoryPath, file.name));
          }
        })
      );
    }

    await fs.rmdir(directoryPath);
  } catch (_error) {
    const error = _error as NodeJS.ErrnoException;
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};
