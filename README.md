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

## Benchmarks

| runner   | single TS file | big TS project | install time | install size | compat #1 | compat #2 | compat #3 | compat #4 |
| -------- | -------------: | -------------: | -----------: | -----------: | :-------: | :-------: | :-------: | :-------: |
| xnr      |        `0.14`s |        `0.56`s |      `4.82`s |      `3.9`MB |    ✅     |    ✅     |    ✅     |    ✅     |
| esr      |        `0.08`s |        `0.12`s |      `7.71`s |     `10.6`MB |    ✅     |    ✅     |    ✅     |    ❌     |
| swc-node |        `0.22`s |        `0.38`s |     `37.88`s |     `95.1`MB |    ✅     |    ✅     |    ❌     |    ❌     |
| ts-node  |        `0.65`s |        `1.60`s |     `16.10`s |     `45.2`MB |    ✅     |    ❌     |    ❌     |    ❌     |

> <details>
>
> <summary><strong>Methodology</strong></summary>
>
> ### single ts file
>
> ```ts
> const run = (date: Date): void => {
>   console.log(
>     [
>       date.getFullYear(),
>       (date.getMonth() + 1).toString().padStart(2, "0"),
>       date.getDate().toString().padStart(2, "0"),
>     ].join("-")
>   );
> };
>
> run(new Date(3000, 0, 1));
> ```
>
> ### big ts project + compat tests
>
> Measured by running a simple script that imports the `date-fn` (TypeScript) > source files
> directly.
>
> ```ts
> // repo:date-fns/src/index.ts
> import { format } from "(date-fns-source)";
> // where `(date-fn-source)` =>
> //   #1 `./src`
> //   #2 `./src/index.ts`
> //   #3 `./src/index.js`
> //   #4 `./src` with `"type": "module"` in package.json
> // support for each import path varies by runner
>
> const run = (): void => {
>   console.log(format(new Date(3000, 0, 1), "yyyy-MM-dd"));
> };
>
> run();
> ```
>
> ### the actual script
>
> ```sh
> echo "xnr:"
> start_timer && node ./node_modules/.bin/xnr ./file.ts && print_timer
> echo "ts-node:"
> start_timer && node ./node_modules/.bin/ts-node ./file.ts && print_timer
> echo "esr:"
> start_timer && node ./node_modules/.bin/esr ./file.ts && print_timer
> echo "swc-node:"
> start_timer && node -r @swc-node/register ./file.ts && print_timer
> ```
>
> 2023-05-12, 3 run avg, MacBook Pro w/ M1 Pro
>
> ### byte size
>
> installed required dependencies with npm into an empty dir, then:  
> `rm package.json && rm package-lock.json && du -sk .`
>
> ### install time
>
> tested with my (slow 😢) 1.5MB/s Wi-Fi download speed (no cache, 3 run avg)
>
> </details>

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
