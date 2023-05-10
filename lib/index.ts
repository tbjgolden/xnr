import { exclamation } from "./exclamation.js";

export const hello = (world: string): string => {
  return exclamation(`Hello ${world}`);
};
