# xnr

![banner](banner.svg)

![npm](https://img.shields.io/npm/v/xnr)
![npm type definitions](https://img.shields.io/npm/types/xnr)
![license](https://img.shields.io/npm/l/xnr)
[![install size](https://packagephobia.com/badge?p=xnr)](https://packagephobia.com/result?p=xnr)

Easily, quickly, and reliably run a Node.js script from the CLI with zero configuration. _As fast
and simple as [`tsx`](https://github.com/privatenumber/tsx) with a much faster install._

```sh
npx xnr any-file.{ts,tsx,cts,mts,js,jsx,cjs,mjs}
```

## Key Features

- **Zero Configuration**: Run your TypeScript files directly without needing a `tsconfig` file or
  any additional setup. Ideal for quick scripts or CI tasks.
- **Supports Multiple File Types**: Easily run any combination of TypeScript, JavaScript, JSON and
  JSX files.
- **Fast Execution**: Skips TypeScript type checking for instant execution.
- **Lightweight**: Including dependencies &lt;7MB, ideal for CI pipelines.
- **Flexible and Tolerant**: Works well with different module systems and rogue npm dependencies
  that expect either `require` or `import`.
- **Efficient Build System**: Uses `sucrase` to transpile TypeScript to JavaScript and performs fast
  AST manipulations for optimal interop.

## Why Choose xnr?

- **Quick and Simple**: Ideal for running TypeScript files without the overhead of setting up a
  complex build environment or configuration files.
- **Better Interoperability**: More seamless integration with different module systems compared to
  `ts-node`.
- **Optimised for Speed**: Faster install and execution times than `swc` or `esbuild-runner` because
  `xnr` doesn’t rely on compiled binaries from other languages.
- **Focused Scope**: Designed to reduce the hassle of running TypeScript in Node.js without
  overreaching into other tasks or environments.

## Common Use Cases

1. **Local Development**: Quickly run TypeScript scripts for development purposes without setting up
   a full build pipeline.
2. **CI/CD Pipelines**: Use `xnr` in CI environments to run scripts or tests without needing to
   install heavy dependencies or run long build processes.
3. **Utility Scripts**: Ideal for writing and running small utility scripts for tasks like linting,
   formatting, or automating project workflows.

## Getting Started

### Running a Script

Simply use `npx` to run your TypeScript or JavaScript file:

```sh
npx xnr your-file.ts
```

### Installation

While you can use `xnr` directly with `npx`, you might want to install it for frequent use:

```sh
npm install --save-dev xnr
```

### Building for Later Execution

You can also build your script and dependencies for later use:

```sh
# Requires xnr to be installed
npx xnrb your-file.ts your-build-dir
#~> your-build-dir/your-file.cjs

# xnrb builds the project, and logs the entryfile
node your-build-dir/your-file.cjs
```

## Caveats and Scope

- **Platform Support**: Currently, `xnr` does not support Windows. Contributions to add Windows
  support are welcome!
- **JSX/TSX Assumptions**: Assumes JSX is React in `.jsx` and `.tsx` files. Other JSX targets may be
  supported in future versions.
- **Dynamic Imports/Requires**: Only supports dynamic imports or requires with static strings (e.g.
  `require("./file.ts")` will work but `require(someVar)` will not)
- **Node.js Environment**: Requires Node.js LTS version 16 or higher (for full ES module support).

## Performance and Limitations

- **No Type Checking**: Skips TypeScript type checking to speed up execution. If type checking is
  needed, consider using `ts-node` or running TypeScript directly.

## API

`xnr` also provides an API for more advanced usage:

```ts
// Convert an input code string to a Node-friendly ESM code string
export const transform = ({
  code: string,
  filePath?: string,
}) => Promise<string>;

// Convert source code from an entry file into a directory of Node-friendly ESM code
export const build = ({
  filePath: string,
  outputDirectory: string,
}) => Promise<BuildResult>;

// Runs a file, auto-transpiling it and its dependencies as required
export const run = async (
  filePathOrConfig: string | RunConfig
) => Promise<number>;
```

## Key benchmarks

| runner    | npx single-ts-file | (preinstalled) | install size |
| --------- | -----------------: | -------------: | -----------: |
| xnr@2.0.0 |           `0.7`sec |       `0.3`sec |      `0.4`MB |
| xnr@1.1.4 |           `0.8`sec |       `0.3`sec |      `6.7`MB |
| ts-node   |           `0.9`sec |       `0.8`sec |      `6.7`MB |
| esr       |           `1.8`sec |       `0.4`sec |     `29.9`MB |
| tsx       |           `4.9`sec |       `0.3`sec |     `29.7`MB |
| swc-node  |           `5.4`sec |       `0.2`sec |     `62.0`MB |

In general you can expect best-in-class install + run time.

## Contributing

Feel free to open issues if you encounter bugs or have suggestions for new features. Windows support
and additional JSX framework compatibility are areas for potential contributions.

## Licence

Apache-2.0
