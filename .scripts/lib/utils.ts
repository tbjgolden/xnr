import { lstat, readFile } from "node:fs/promises";

export const isDirectory = async (path: string): Promise<boolean> => {
  try {
    return (await lstat(path)).isDirectory();
  } catch {
    return false;
  }
};

export const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
};

export const checkDirectory = async () => {
  if (!(await isFile(process.cwd() + "/package.json"))) {
    throw new Error("must be run from package root");
  }
};

type JSONPrimitive = string | number | boolean | null;
type JSONArray = JSONValue[];
type JSONObject = { [Key in string]: JSONValue } & { [Key in string]?: JSONValue | undefined };
type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type PackageJson = Partial<{
  private: boolean;
  name: string;
  version: string;
  description: string;
  homepage: string;
  license: string;
  main: string;
  module: string;
  exports: string;
  types: string;
  browser: string;
  keywords: string[];
  files: string[];
  workspaces: string[];
  bundleDependencies: string[];
  os: string[];
  cpu: string[];
  bin: Record<string, string | undefined>;
  directories: Record<string, string | undefined>;
  scripts: Record<string, string | undefined>;
  config: Record<string, string | undefined>;
  dependencies: Record<string, string | undefined>;
  devDependencies: Record<string, string | undefined>;
  peerDependencies: Record<string, string | undefined>;
  optionalDependencies: Record<string, string | undefined>;
  overrides: Record<string, string | undefined>;
  engines: Record<string, string | undefined>;
  peerDependenciesMeta: Record<string, Record<string, string | undefined> | undefined>;
  bugs: { url?: string; email?: string };
  author: string | { name?: string; url?: string; email?: string };
  funding: string | { type?: string; url?: string };
  repository: string | { type: string; url: string };
  [key: string]: unknown;
}>;

const expecter = (checker: (value: unknown) => boolean): ((value: unknown) => void) => {
  return (value: unknown) => {
    if (value !== undefined) {
      const result = checker(value);
      if (!result) {
        throw "";
      }
    }
  };
};

const expectToBeAString = expecter((value) => typeof value === "string");
const expectToBeAStringArray = expecter((value) => {
  return Array.isArray(value) && value.every((element) => typeof element === "string");
});
const expectToBeAStringMap = expecter((value) => {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((element) => typeof element === "string")
  );
});
const expectToBeAStringMapMap = expecter((value) => {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (element) =>
        element !== null &&
        typeof element === "object" &&
        !Array.isArray(element) &&
        Object.values(element).every((element) => typeof element === "string")
    )
  );
});
const expectToBeStringOrStringMap = expecter((value) => {
  return (
    typeof value === "string" ||
    (value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every((element) => typeof element === "string"))
  );
});

export const getPackageJson = async (): Promise<PackageJson> => {
  const json = await readFile(process.cwd() + "/package.json", "utf8");
  const obj = (JSON.parse(json) ?? {}) as JSONObject;
  let key = "";
  try {
    for (key of [
      "name",
      "version",
      "description",
      "homepage",
      "license",
      "main",
      "module",
      "exports",
      "types",
      "browser",
    ]) {
      expectToBeAString(obj[key]);
    }
    for (key of ["keywords", "files", "workspaces", "bundleDependencies", "os", "cpu"]) {
      expectToBeAStringArray(obj[key]);
    }
    for (key of [
      "bin",
      "directories",
      "scripts",
      "config",
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
      "overrides",
      "engines",
      "bugs",
    ]) {
      expectToBeAStringMap(obj[key]);
    }
    for (key of ["peerDependenciesMeta"]) {
      expectToBeAStringMapMap(obj[key]);
    }
    for (key of ["author", "funding", "repository"]) {
      expectToBeStringOrStringMap(obj[key]);
    }
  } catch {
    throw new Error(`Unexpected type found in package.json for "${key}"`);
  }
  return obj as PackageJson;
};

export const readJSON = <T = unknown>(jsonString: string): T => {
  return JSON.parse(removeJSONComments(jsonString));
};

export const writeJSON = <T extends JSONObject | JSONArray>(jsonString: T): string => {
  return JSON.stringify(jsonString);
};

export const removeJSONComments = (jsonString: string): string => {
  let isInsideString = false;
  let isInsideComment: 0 | 1 | 2 = 0;
  let offset = 0;
  let result = "";

  for (let index = 0; index < jsonString.length; index += 1) {
    const currentCharacter = jsonString[index];
    const nextCharacter = jsonString[index + 1];

    if (!isInsideComment && currentCharacter === '"' && !isEscaped(jsonString, index)) {
      isInsideString = !isInsideString;
    }

    if (isInsideString) {
      continue;
    }

    if (!isInsideComment && currentCharacter + nextCharacter === "//") {
      result += jsonString.slice(offset, index);
      offset = index;
      isInsideComment = 1;
      index += 1;
    } else if (isInsideComment === 1 && currentCharacter + nextCharacter === "\r\n") {
      index += 1;
      isInsideComment = 0;
      result = String(result);
      offset = index;
      continue;
    } else if (isInsideComment === 1 && currentCharacter === "\n") {
      isInsideComment = 0;
      result = String(result);
      offset = index;
    } else if (!isInsideComment && currentCharacter + nextCharacter === "/*") {
      result += jsonString.slice(offset, index);
      offset = index;
      isInsideComment = 2;
      index += 1;
      continue;
    } else if (isInsideComment === 2 && currentCharacter + nextCharacter === "*/") {
      index += 1;
      isInsideComment = 0;
      result = String(result);
      offset = index + 1;
      continue;
    }
  }

  return result + (isInsideComment ? "" : jsonString.slice(offset));
};

const isEscaped = (jsonString: string, quotePosition: number): boolean => {
  let index = quotePosition - 1;
  let backslashCount = 0;

  while (jsonString[index] === "\\") {
    index -= 1;
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
};
