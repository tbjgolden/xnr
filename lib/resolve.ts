import path from "node:path/posix";

const KNOWN_EXT_REGEX = /\.([jt]sx?|[cm][jt]s)$/i;
type KnownExtension = "js" | "ts" | "jsx" | "tsx" | "cjs" | "cts" | "mjs" | "mts";
type Strategy = "ts>tsx" | "tsx>ts" | "mts" | "cts" | "mjs" | "cjs" | "js>jsx" | "jsx>js";

type ExtOrderMap = {
  [k in KnownExtension]?: Strategy[] | undefined;
};

const EXT_ORDER_MAP_MODULE: ExtOrderMap = {
  // ts
  ts: ["ts>tsx", "mts", "mjs", "js>jsx", "cts", "cjs"],
  tsx: ["tsx>ts", "jsx>js", "mts", "mjs", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx>ts", "jsx>js", "mts", "mjs"],
  mts: ["mts", "mjs", "ts>tsx", "js>jsx", "cts", "cjs"],
  // js
  jsx: ["jsx>js", "tsx>ts", "mjs", "mts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx>js", "tsx>ts", "mjs", "mts"],
  mjs: ["mjs", "mts", "js>jsx", "ts>tsx", "cjs", "cts"],
  // js, json* can use default order
};
const EXT_ORDER_MAP_COMMONJS: ExtOrderMap = {
  // ts
  ts: ["ts>tsx", "js>jsx", "cts", "cjs"],
  tsx: ["tsx>ts", "jsx>js", "cts", "cjs"],
  cts: ["cts", "cjs", "tsx>ts", "jsx>js"],
  mts: ["mts", "mjs", "ts>tsx", "js>jsx", "cts", "cjs"],
  // js
  jsx: ["jsx>js", "tsx>ts", "cjs", "cts"],
  cjs: ["cjs", "cts", "jsx>js", "tsx>ts"],
  mjs: ["mjs", "mts", "js>jsx", "ts>tsx", "cjs", "cts"],
  // js, json* can use default order
};

export const resolveLocalImport = ({
  type,
  absImportPath: absImportPathMaybeWithSlash,
  parentExt,
  checkFile,
}: {
  type: "require" | "import";
  absImportPath: string;
  parentExt: string;
  checkFile: (filePath: string) => boolean;
}): string | undefined => {
  const doesImportPathEndWithSlash = absImportPathMaybeWithSlash.endsWith("/");
  const absImportPath = path.join(absImportPathMaybeWithSlash, ".");

  const isFileTsLike = Boolean(parentExt.includes("ts"));

  let defaultOrder: Strategy[];
  if (type === "import") {
    defaultOrder = isFileTsLike
      ? ["mts", "mjs", "ts>tsx", "js>jsx", "cts", "cjs"]
      : ["mjs", "mts", "js>jsx", "ts>tsx", "cjs", "cts"];
  } else {
    defaultOrder = isFileTsLike
      ? ["cts", "cjs", "ts>tsx", "js>jsx"]
      : ["cjs", "cts", "js>jsx", "ts>tsx"];
  }

  const t = (filePath: string): string | undefined => {
    if (checkFile(filePath)) return filePath;
  };

  const resolveAsDirectory = () => {
    for (const strategy of defaultOrder) {
      const file = runStrategy(absImportPath + "/index", strategy, t);
      if (file) return file;
    }
  };

  if (doesImportPathEndWithSlash) return resolveAsDirectory();

  let knownImportExt = getKnownExt(absImportPath);
  if (knownImportExt) {
    if (isFileTsLike) {
      if (knownImportExt === "js") knownImportExt = "ts";
      else if (knownImportExt === "cjs") knownImportExt = "cts";
      else if (knownImportExt === "mjs") knownImportExt = "mts";
      else if (knownImportExt === "jsx") knownImportExt = "tsx";
    }
    /* eslint-disable security/detect-object-injection */
    const order =
      (type === "import"
        ? EXT_ORDER_MAP_MODULE[knownImportExt]
        : EXT_ORDER_MAP_COMMONJS[knownImportExt]) ?? defaultOrder;
    /* eslint-enable security/detect-object-injection */
    return (
      t(absImportPath.slice(0, -knownImportExt.length) + knownImportExt) ??
      resolveLocalImportKnownExt(absImportPath, order, t, resolveAsDirectory)
    );
  } else {
    return resolveLocalImportUnknownExt(absImportPath, defaultOrder, t, resolveAsDirectory);
  }
};

const resolveLocalImportUnknownExt = (
  absImportPath: string,
  order: Strategy[],
  t: (filePath: string) => string | undefined,
  resolveAsDirectory: () => string | undefined
): string | undefined => {
  const file = t(absImportPath) ?? resolveAsDirectory();
  if (file) return file;

  for (const strategy of order) {
    const file = runStrategy(absImportPath, strategy, t);
    if (file) return file;
  }
};

const resolveLocalImportKnownExt = (
  absImportPath: string,
  order: Strategy[],
  t: (filePath: string) => string | undefined,
  resolveAsDirectory: () => string | undefined
): string | undefined => {
  const file = resolveAsDirectory();
  if (file) return file;

  const absImportPathWithoutExt = absImportPath.slice(
    0,
    absImportPath.length - path.extname(absImportPath).length
  );

  for (const strategy of order) {
    const file = runStrategy(absImportPathWithoutExt, strategy, t);
    if (file) return file;
  }
};

const runStrategy = (
  base: string,
  strategy: Strategy,
  t: (filePath: string) => string | undefined
) => {
  // eslint-disable-next-line unicorn/prefer-switch
  if (strategy === "ts>tsx") {
    return t(base + ".ts") ?? t(base + ".tsx") ?? t(base + ".d.ts");
  } else if (strategy === "tsx>ts") {
    return t(base + ".tsx") ?? t(base + ".ts") ?? t(base + ".d.ts");
  } else if (strategy === "js>jsx") {
    return t(base + ".js") ?? t(base + ".jsx");
  } else if (strategy === "jsx>js") {
    return t(base + ".jsx") ?? t(base + ".js");
  } else if (strategy === "cts") {
    return t(base + ".cts") ?? t(base + ".d.cts");
  } else if (strategy === "mts") {
    return t(base + ".mts") ?? t(base + ".d.mts");
  } else if (strategy === "cjs") {
    return t(base + ".cjs");
  } else {
    return t(base + ".mjs");
  }
};

const getKnownExt = (filePath: string): KnownExtension | undefined => {
  const match = path.extname(filePath).match(KNOWN_EXT_REGEX);
  return match ? (match[0].slice(1).toLowerCase() as KnownExtension) : undefined;
};
