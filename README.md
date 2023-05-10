# xnr

![banner](banner.svg)

![npm](https://img.shields.io/npm/v/xnr)
![npm type definitions](https://img.shields.io/npm/types/xnr)
![license](https://img.shields.io/npm/l/xnr)
[![install size](https://packagephobia.com/badge?p=xnr)](https://packagephobia.com/result?p=xnr)

Easily, quickly and reliably run a Node.js script written in TypeScript from the CLI.

```sh
npx xnr any-file.{ts,js,mjs,cjs,*}
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

> _\* uses [`sucrase`](https://github.com/alangpierce/sucrase) to convert to TypeScript to
> JavaScript, and then performs fast AST manipulations to make the interop work - no
> tsc/babel/esbuild/swc here_

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

## Install

This package is available from the `npm` registry.

```sh
npm install xnr
```

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

## API

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

## Contributing

- State where users can ask questions.
- State whether PRs are accepted.
- List any requirements for contributing; for instance, having a sign-off on commits.

Dev environment requires:

- node >= 16.14.0
- npm >= 6.8.0
- git >= 2.11

Not yet verified on Windows (if you are facing issues on Windows, please leave a bug report!)

## Licence

Apache-2.0
