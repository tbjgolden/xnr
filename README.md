# xnr

![banner](banner.svg)

![npm](https://img.shields.io/npm/v/xnr)
![npm type definitions](https://img.shields.io/npm/types/xnr)
![license](https://img.shields.io/npm/l/xnr)
[![install size](https://packagephobia.com/badge?p=xnr)](https://packagephobia.com/result?p=xnr)

Easily, quickly and reliably run a Node.js script from the CLI.

```sh
npx xnr any-file.{ts,tsx,cts,mts,js,jsx,cjs,mjs}
```

- **converts local dependencies** &mdash; will transpile anything needed to run the file
- **zero config** &mdash; it should just work - but if it doesn't work, leave an issue!
- **fast** &mdash; skips TypeScript type checking
- **light** &mdash; <4MB including dependencies = faster CI
- **tolerant** &mdash; makes as few assumptions as possible
  - supports tsconfig paths if provided
  - equally, doesn't need tsconfig
  - plays nice with rogue npm dependencies that expect one of `require` or `import`
- just performant\* JavaScript &mdash; no Rust or Golang!

> _\* uses [`sucrase`](https://github.com/alangpierce/sucrase) to convert to TypeScript to
> JavaScript, and then performs fast AST manipulations to make the interop work - no
> tsc/babel/esbuild/swc here_

## Key benchmarks

| runner    | npx single-ts-file | (preinstalled) | install size |
| --------- | -----------------: | -------------: | -----------: |
| xnr@2.0.0 |           `0.7`sec |       `0.3`sec |      `6.7`MB |
| xnr@1.1.4 |           `0.8`sec |       `0.3`sec |      `6.7`MB |
| ts-node\* |           `0.9`sec |       `0.8`sec |      `6.7`MB |
| esr       |           `1.8`sec |       `0.4`sec |     `29.9`MB |
| swc-node  |           `5.4`sec |       `0.2`sec |     `62.0`MB |

\* does a type check. ~200ms faster with --transpile-only

<details>

<summary><em>Test file</em></summary>

```ts
const run = (date: Date): void => {
  console.log(
    [
      date.getFullYear(),
      (date.getMonth() + 1).toString().padStart(2, "0"),
      date.getDate().toString().padStart(2, "0"),
    ].join("-")
  );
};

run(new Date(3000, 0, 1));
```

</details>

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

> `your-build-dir` contains all the needed local dependencies (transpiled) to run the file natively

## API

```ts
// Convert an input code string to a node-friendly esm code string
export declare const transform: (
  inputCode: string,
  filePath?: string | undefined
) => Promise<string>;

// Convert source code from an entry file into a directory of node-friendly esm code
export declare const build: (
  entryFilePath: string,
  outputDirectory?: string | undefined
) => Promise<string | undefined>;

// Runs a file, no questions asked (auto-transpiling it and its dependencies as required)
export declare const run: (
  entryFilePath: string,
  args?: string[],
  outputDirectory?: string | undefined
) => Promise<number>; // status code
```

---

Please leave bug reports if something doesn't work as expected! 😄

## Licence

Apache-2.0
