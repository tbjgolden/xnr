# xnr

![banner](banner.svg)

![npm](https://img.shields.io/npm/v/xnr)
![npm type definitions](https://img.shields.io/npm/types/xnr)
![license](https://img.shields.io/npm/l/xnr)
[![install size](https://packagephobia.com/badge?p=xnr)](https://packagephobia.com/result?p=xnr)

Easily, quickly, and reliably run a TypeScript Node.js script from the CLI with zero configuration.
_Blazingly fast 🚀_

```sh
npx xnr any-file.{ts,tsx,cts,mts,js,jsx,cjs,mjs}
```

Ideal for **utility scripts**, **quick debugging** and **CI pipelines**

## Key Features

- **Zero configuration**: Run your TypeScript files directly without needing a `tsconfig` file or
  any additional setup. Ideal for quick scripts or CI tasks
- **Supports multiple file types**: Easily run any combination of TypeScript, JavaScript, JSON and
  JSX files
- **Lightweight**: Very quick to install at just ~400kB
- **Flexible and familiar**: Tolerant to different file extensions, but otherwise follows Node
  conventions
- **Optimised for Speed**: Faster install+execution time than `xnr`
- **Focused Scope**: Single goal: run TypeScript code quickly and reliably
- **Supports Windows**

## Getting Started

### Installation

While you can use `xnr` directly with `npx`, you can also install it for frequent use:

```sh
npm install --save-dev xnr
```

### Running a Script

Simply use `npx` to run your TypeScript or JavaScript file:

```sh
npx xnr file.ts
```

For running dev scripts in your package.json:

```json
{
  "scripts": {
    "run": "xnr run.ts"
  }
}
```

## Caveats and Scope

- Only supports dynamic imports or requires with static strings (e.g. `require("./file.ts")` will
  work but `require(someVar)` will not)
- Requires Node.js 16.14 or higher (for full ES module support)

## CLI

CLI docs can be viewed at any time by running `xnr --help`.

## API

`xnr` also provides an API with a few more options than the CLI:

```ts
// Runs a file with auto-transpilation of it and its dependencies, as required.
const run: (filePathOrConfig: string | RunConfig) => Promise<number>;

// Converts all local source code starting from an entry file into a directly runnable directory of Node.js compatible code.
const build: ({
  filePath,
  outputDirectory,
}: {
  filePath: string;
  outputDirectory: string;
}) => Promise<Output>;

// Converts all local source code starting from an entry file into a runnable array of Node.js compatible file contents.
const transpile: ({ filePath }: { filePath: string }) => Promise<Output>;

// Transforms an input code string into a Node-friendly ECMAScript Module (ESM) code string. Unlike the others here, it doesn't rewrite imports.
const transform: ({ code, filePath }: { code: string; filePath?: string }) => Promise<string>;
```

A complete list of exports can be viewed on
[`npmjs.com`](https://www.npmjs.com/package/xnr?activeTab=code) (navigate to
/xnr/dist/lib/index.d.ts)

## Jest transformer

Add these lines to your jest config to get easy TS transforms:

```json
{
  // ...
  "extensionsToTreatAsEsm": [".ts"],
  "transform": {
    "\\.ts$": "<rootDir>/node_modules/xnr/dist/jest.js"
  }
  // ...
}
```

## Key benchmarks

| runner   | run single file | run small project | install size | install time |
| -------- | --------------: | ----------------: | -----------: | -----------: |
| xnr      |          `93`ms |           `102`ms |      `0.4`MB |   very quick |
| tsx      |         `142`ms |           `146`ms |     `29.7`MB |         slow |
| swc-node |         `232`ms |           `235`ms |     `62.0`MB |    very slow |
| ts-node  |         `661`ms |           `659`ms |      `6.7`MB |        quick |

In general, you can expect best-in-class install + run time.

## Contributing

Feel free to open issues if you encounter bugs or have suggestions for new features.

## Licence

Apache-2.0
