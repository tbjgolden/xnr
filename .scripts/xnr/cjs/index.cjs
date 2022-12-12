let xnr;
export const transform = async (...args) => {
  if (xnr === undefined) {
    xnr = await import("../esm/index.js")
  }
  return xnr.transform(...args);
};
export const build = async (...args) => {
  if (xnr === undefined) {
    xnr = await import("../esm/index.js")
  }
  return xnr.build(...args);
};
export const run = async (...args) => {
  if (xnr === undefined) {
    xnr = await import("../esm/index.js")
  }
  return xnr.run(...args);
};