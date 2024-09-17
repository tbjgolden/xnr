import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import unicorn from "eslint-plugin-unicorn";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { escapePath } = require("fast-glob");

const simpleImportSort = require("eslint-plugin-simple-import-sort");
const eslintConfigPrettier = require("eslint-config-prettier");

/** @type { import("eslint").Linter.Config[] } */
const config = [
  {
    ignores: [...getIgnoresFromGitignore(), "lib/__fixtures__", ".scripts/build-tests"],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts}"],
    rules: {
      ...eslint.configs.recommended.rules,
      "no-warning-comments": "warn",
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // assume js based files are node
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node },
    },
    rules: { ...eslint.configs.recommended.rules },
  },
  {
    // assume ts based files are web
    files: ["**/*.{ts,tsx,mts}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "simple-import-sort": simpleImportSort,
      unicorn,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parser: tseslint.parser,
      globals: { ...globals.browser },
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: [path.join(__dirname, "tsconfig.eslint.json")],
        extraFileExtensions: [".html"],
      },
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      ...rulesFromConfig(tseslint.configs.recommendedTypeChecked),
      ...rulesFromConfig(tseslint.configs.stylisticTypeChecked),
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/dot-notation": ["error", { allowPrivateClassPropertyAccess: true }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-throw-literal": "off",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_.*", varsIgnorePattern: "^_.*" },
      ],
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "variable",
          types: ["boolean"],
          format: ["PascalCase", "UPPER_CASE"],
          /* prettier-ignore */
          prefix: [
            'is', 'are', 'should', 'has', 'can', 'did', 'does', 'will',
            'IS_', 'ARE_', 'SHOULD_', 'HAS_', 'CAN_', 'DID_', 'DOES_', 'WILL_'
          ],
        },
      ],
      "@typescript-eslint/require-await": "off",

      ...rulesFromConfig(unicorn.configs.recommended),
      "unicorn/consistent-destructuring": "error",
      "unicorn/filename-case": "off",
      "unicorn/no-array-callback-reference": "off",
      "unicorn/no-array-reduce": ["warn", { allowSimpleOperations: true }],
      "unicorn/no-empty-file": "off",
      "unicorn/no-new-array": "off",
      "unicorn/no-null": "off",
      "unicorn/no-thenable": "off",
      "unicorn/no-unreadable-array-destructuring": "off",
      "unicorn/no-useless-fallback-in-spread": "warn",
      "unicorn/no-useless-spread": "warn",
      "unicorn/no-useless-undefined": "off",
      "unicorn/no-await-expression-member": "off",
      "unicorn/prefer-switch": ["error", { minimumCases: 5 }],
      "unicorn/prefer-top-level-await": "off",
      "unicorn/prevent-abbreviations": [
        "warn",
        {
          extendDefaultReplacements: false,
          replacements: {
            def: {
              defer: true,
              deferred: true,
              define: true,
              definition: true,
            },
            dir: { direction: true, directory: true },
            docs: { documentation: true, documents: true },
            dst: {
              daylightSavingTime: true,
              destination: true,
              distribution: true,
            },
            e: { error: true, event: true, end: true },
            rel: { related: true, relationship: true, relative: true },
            res: { response: true, result: true },
          },
          allowList: { e2e: true },
        },
      ],
      "unicorn/switch-case-braces": ["error", "avoid"],

      // Must be last: it disables rules that disagree with prettier including some plugins' rules
      ...rulesFromConfig(eslintConfigPrettier),
    },
    settings: {
      react: { pragma: "React", version: "detect" },
    },
  },
  {
    files: ["**/*.d.{ts,tsx,mts}"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-empty-interface": "off",
    },
  },
  {
    files: ["**/*-spec.{js,ts,tsx}", "**/*.spec.{js,ts,tsx}", "**/tests/**/*.{js,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.jest, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    // Temporary. Remove this when all files are converted to TypeScript.
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
  },
];

export default config;

// Some ESLint configs we use try to configure other linter settings besides the rules.
// This function converts them to a single rules record, so we can manage those settings ourselves.
/**
 * @param { import("eslint").Linter.Config | import("eslint").Linter.Config[] } config_
 * @param { (entry: import("eslint").Linter.RuleEntry, rule: string) => import("eslint").Linter.RuleEntry } [transformEntry]
 * @returns { Readonly<import("eslint").Linter.RulesRecord> }
 * */
function rulesFromConfig(config_, transformEntry = (entry) => entry) {
  const config = Array.isArray(config_) ? config_ : [config_];
  /** @type { import("eslint").Linter.RulesRecord } */
  let rulesRecord = {};
  for (const obj of config) {
    if ("rules" in obj && obj.rules) {
      for (const [rule, entry] of Object.entries(obj.rules)) {
        if (entry) {
          rulesRecord[rule] = transformEntry(entry, rule);
        }
      }
    }
  }
  return rulesRecord;
}

// This reads our .gitignore and converts into ignore patterns that ESLint can use.
// Derived from: https://github.com/mysticatea/eslint-gitignore/blob/master/lib/index.ts
/**
 * @returns { string[] }
 * */
function getIgnoresFromGitignore() {
  const filePath = path.join(__dirname, ".gitignore");
  const dirPath = escapePath(
    `/${path.relative(process.cwd(), path.dirname(filePath)).split(path.sep).join("/")}`
  );

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((trimmedLine) => trimmedLine && !trimmedLine.startsWith("#"))
    .map((pattern) => {
      if (dirPath === "/") {
        return pattern;
      } else {
        const isNegative = pattern.startsWith("!");
        const body = isNegative ? pattern.slice(1) : pattern;
        const prefix = body.startsWith("/") ? dirPath : `${dirPath}/**/`;
        const converted = (isNegative ? "!" : "") + prefix + body;
        return converted;
      }
    });
}
