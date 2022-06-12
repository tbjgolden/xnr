# `xnr` (xtreme node runner)

![xtreme](xtreme.jpg)

Run any node file (written in any JS/TS variant) from the CLI.

## Features

- No config, just works
- Written in JS only
- Tolerant to mixed modules, JSX and TypeScript
- ...

## Comparison to other tools

...

## Getting Started

...

## Requirements

...

## API

...

## License

Apache-2.0

<!--

Todos before beta:

Verify the full table and create a test suite.

- [ ] {js, jsx, ts, tsx, mjs, cjs, npmlib:mjs, npmlib:cjs} ^ 2
- [ ] files should not always become mjs
- [ ] https://nodejs.org/api/esm.html#differences-between-es-modules-and-commonjs
  - [x] No require
  - [x] __dirname
  - [x] No Native Module Loading
  - [x] No require.resolve
  - [x] __filename
  - [ ] No exports or module.exports
  - [ ] No NODE_PATH
  - [ ] No require.extensions
  - [ ] No require.cache

Todos before full release:

- [ ] optimise
  - [ ] less blocking code
  - [ ] find ways to parallelise
  - [ ] rewrite to avoid typescript-estree
  - [ ] reuse asts
- [ ] make polyfills a bit more resilient

-->
