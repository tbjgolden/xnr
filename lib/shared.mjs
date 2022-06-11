import { builtinModules } from "node:module";
const BUILTINS = new Set(builtinModules);

export const isNodeBuiltin = (dependency) => {
  if (dependency.startsWith("node:")) return true;
  if (dependency === "test") return false;
  return BUILTINS.has(dependency);
};
