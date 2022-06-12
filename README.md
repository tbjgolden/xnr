# `xnr` (xtreme node runner)

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/tbjgolden/xnr/tests)

![xtreme](xtreme.jpg)

Easily run any Node.js script (written in any JS/TS syntax) from the CLI.

```sh
npx xnr any-file.{ts,js,mjs,cjs,tsx,jsx,*}
```

- **zero config** &mdash; it should just work - but if it doesn't work, leave an issue!
- **fast** &mdash; skips TypeScript type checking
- **light** &mdash; 4MB including dependencies = faster CI
- **tolerant** &mdash; makes as few assumptions as possible
- just performant JavaScript &mdash; no Rust or Golang!

## Comparison to other tools

webpack, rollup, swc, esbuild can all be used, but are not designed for runs.

- ts-node
  - xnr is zero config, ts-node is medium config
  - xnr is faster
  - xnr is way lighter
  - ts-node has issues with esm and cjs interop
- swc-node
  - xnr is zero config, swc is low config
  - xnr is not as fast
  - xnr is way lighter
  - swc-node doesn't run dependencies
- esbuild-runner
  - xnr is zero config, esbuild-runner is low config
  - xnr is not as fast
  - xnr is way lighter
  - esbuild-runner has issues with esm and cjs interop

Benchmarks

- xnr
  - size: 3.4MB
  - speed: 28.3ms/run
  - passes interop test out-of-box: 18/18
- ts-node
  - size: 70MB
  - speed: 158.5ms/run
  - config issues during setup: 1
  - passes interop test out-of-box\*: 10/18
- swc-node
  - size: 208M
  - speed: 22.4ms/run
  - passes interop test: 12/18 (couldn't bundle)
- esbuild-runner
  - size: 9.2M
  - speed: 75.3ms/run
  - passes interop test: 17/18 (couldn't import ts from mjs)

\* using sample config on README

## Getting Started

```sh
npm install xnr
```

or for a one-time run

```sh
npx xnr your-file.ts
```

You can also use this project to build!

```sh
# if xnr is installed
npx xnrb <your-dir>
```

## Requirements

- Node with ES Modules support
- Not checked or verified on Windows

## API

...

## License

Apache-2.0

<!--

Todos before full release:

- [ ] optimise
  - [ ] less blocking code
  - [ ] find ways to parallelise
  - [ ] rewrite to avoid typescript-estree
  - [ ] reuse asts
- [ ] make polyfills a bit more resilient

-->
