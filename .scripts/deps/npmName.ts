import { builtins } from "./builtins";

const SPECIAL_CHAR_REGEX = /[!'()*~]/;

export const validate = function (name: string) {
  const errors = [];

  if (name.length === 0) {
    errors.push("name length must be greater than zero");
  }

  if (/^\./.test(name)) {
    errors.push("name cannot start with a period");
  }

  if (name.startsWith("_")) {
    errors.push("name cannot start with an underscore");
  }

  if (name.trim() !== name) {
    errors.push("name cannot contain leading or trailing spaces");
  }

  const nameLC = name.toLowerCase();
  if (nameLC === "node_modules") {
    errors.push("node_modules is a blacklisted name");
  } else if (nameLC === "favicon.ico") {
    errors.push("favicon.ico is a blacklisted name");
  }

  for (const builtin of builtins) {
    if (nameLC === builtin) {
      errors.push(builtin + " is a core module name");
    }
  }

  if (name.length > 214) {
    errors.push("name can no longer contain more than 214 characters");
  }

  if (nameLC !== name) {
    errors.push("name can no longer contain capital letters");
  }

  if (SPECIAL_CHAR_REGEX.test(name)) {
    errors.push("name can no longer contain special characters: ~'!()*");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
