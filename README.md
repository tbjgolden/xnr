# `xnr` xtreme node runner

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/tbjgolden/xnr/tests.yml?branch=main) ![npm](https://img.shields.io/npm/v/xnr)

Easily, quickly and reliably run a Node.js script written in TypeScript/JSX from the CLI.

```sh
npx xnr any-file.{ts,js,mjs,cjs,tsx,jsx,*}
```

- **can handle local dependencies** &mdash; will transpile anything needed to run the file
- **zero config** &mdash; it should just work - but if it doesn't work, leave an issue!
- **fast** &mdash; skips TypeScript type checking
- **light** &mdash; 4MB including dependencies = faster CI
- **tolerant** &mdash; makes as few assumptions as possible
  - supports tsconfig paths if provided
  - equally, doesn't need tsconfig
  - plays nice with rogue npm dependencies that expect one of `require` or `import`
- just performant\* JavaScript &mdash; no Rust or Golang!

> _\* uses [`sucrase`](https://github.com/alangpierce/sucrase) to convert to TypeScript and JSX to JavaScript, and then performs fast AST manipulations to make the interop work - no tsc/babel/esbuild/swc here_

## Benchmarks (2022-06)

- xnr
  - size: 3.4MB
  - speed: 28.3ms/run
  - passes interop test: 18/18
- ts-node
  - size: 70MB
  - speed: 158.5ms/run
  - config issues during setup: 1
  - passes interop test\*: 10/18
- swc-node
  - size: 208M
  - speed: 22.4ms/run
  - passes interop test: 12/18 (couldn't bundle)
- esbuild-runner
  - size: 9.2M
  - speed: 75.3ms/run
  - passes interop test: 17/18 (couldn't import ts from mjs)

\* using sample config on README

Interop test involves testing whether you can import a filetype from another filetype or not.

## Getting Started

**Optional: install it**

```sh
npm install --save-dev xnr
```

**Run it from the CLI**

```ts
const typedFn = (str: string) => console.log(str);
typedFn("hello world");
```

```sh
> npx xnr your-file.ts
hello world
```

**Or build now, run later**

```sh
# requires xnr to be installed
> npx xnrb your-file.ts your-build-dir
your-build-dir/your-file.cjs

> node your-build-dir/your-file.cjs
hello world
```

> `your-build-dir` will contain all transpiled local dependencies needed to run

## Requirements

- `node` `>=16.14.0`
- to use npx above `npm` `>=5.2.0`

Not yet verified on Windows (but help welcome!)

## Node API

```ts
/**
 * Convert an input code string to a node-friendly esm code string
 */
export declare const transform: (
  inputCode: string,
  filePath?: string | undefined
) => Promise<string>;
/**
 * Convert source code from an entry file into a directory of node-friendly esm code
 */
export declare const build: (
  entryFilePath: string,
  outputDirectory?: string | undefined
) => Promise<string | undefined>;
/**
 * Runs a file, no questions asked (auto-transpiling it and its dependencies as required)
 */
export declare const run: (
  entryFilePath: string,
  args?: string[],
  outputDirectory?: string | undefined
) => Promise<number>;
```

## License

Apache-2.0
