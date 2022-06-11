const fs = require("fs");
const path = require("path");

// Use gitignore as eslintignore (single source of truth)
const ignorePatterns = fs
  .readFileSync(path.join(__dirname, ".gitignore"), "utf8")
  .split("\n")
  .map((line) => {
    return line.split("#")[0].trim();
  })
  .filter((withoutComment) => {
    return withoutComment.length > 0;
  });

module.exports = {
  env: {
    browser: true,
    jest: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:unicorn/recommended",
    "prettier",
  ],
  plugins: ["@typescript-eslint", "unicorn", "prettier"],
  ignorePatterns,
  rules: {
    "arrow-body-style": ["warn", "always"],
    "no-array-constructor": "off",
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: false,
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^(_|error$)",
      },
    ],
    "@typescript-eslint/no-array-constructor": ["error"],
    "@typescript-eslint/no-explicit-any": ["warn"],
    "unicorn/filename-case": [
      "error",
      {
        cases: {
          kebabCase: true,
        },
        ignore: ["-env\\.d\\.ts$"],
      },
    ],
    "unicorn/no-null": "off",
    "unicorn/prevent-abbreviations": [
      "error",
      {
        extendDefaultReplacements: false,
        replacements: {
          def: { defer: true, deferred: true, define: true, definition: true },
          dir: { direction: true, directory: true },
          docs: { documentation: true, documents: true },
          dst: { daylightSavingTime: true, destination: true, distribution: true },
          e: { error: true, event: true },
          rel: { related: true, relationship: true, relative: true },
          res: { response: true, result: true },
        },
      },
    ],
    "unicorn/prefer-switch": ["error", { minimumCases: 5 }],
    "unicorn/no-new-array": "off",
  },
  overrides: [
    {
      files: ["*.cjs"],
      rules: {
        "unicorn/prefer-module": "off",
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
