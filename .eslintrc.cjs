module.exports = {
  env: {
    browser: true,
    jest: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:security/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:unicorn/recommended",
    "prettier",
  ],
  plugins: ["@typescript-eslint", "unicorn", "prettier"],
  ignorePatterns: [
    ...require("node:fs")
      .readFileSync(".gitignore", "utf8")
      .split("\n")
      .map((line) => line.split("#")[0].trim())
      .filter((withoutComment) => withoutComment.length > 0),
    "__fixtures__",
  ],
  rules: {
    "arrow-body-style": "off",
    "no-array-constructor": "off",
    "no-console": "error",
    "no-empty": ["error", { allowEmptyCatch: true }],
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
    "unicorn/filename-case": "off",
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
    "unicorn/no-await-expression-member": "off",
  },
  overrides: [
    {
      files: ["*.cjs"],
      rules: {
        "unicorn/prefer-module": "off",
        "@typescript-eslint/no-var-requires": "off",
      },
    },
    {
      files: [".scripts/**/*.ts"],
      rules: {
        "no-console": "off",
        "unicorn/no-process-exit": "off",
      },
    },
  ],
};
