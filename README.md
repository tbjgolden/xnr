```sh
git clone https://github.com/tbjgolden/xnr.git cool-package-name
cd cool-package-name
npx find-repl xnr cool-package-name
rm -rf .git
git init
npm install
```

---

# xnr

![banner](banner.svg)

![npm](https://img.shields.io/npm/v/xnr)
![npm type definitions](https://img.shields.io/npm/types/xnr)
![license](https://img.shields.io/npm/l/xnr)
[![install size](https://packagephobia.com/badge?p=xnr)](https://packagephobia.com/result?p=xnr)

A npm library that does exactly what it says on the tin.

## Table of Contents

## Background

- Cover motivation.
- Cover abstract dependencies.
- Cover compatible versions of Node, npm and ECMAScript.
- Cover similar packages and alternatives.

## Install

This package is available from the `npm` registry.

```sh
npm install xnr
```

## Usage

```sh
npx xnr ...
```

Supports JavaScript + TypeScript:

```ts
import { foo } from "xnr";

foo();
```

Can also be imported via `require("xnr")`.

## API

...

## Credits

...

## Contributing

- State where users can ask questions.
- State whether PRs are accepted.
- List any requirements for contributing; for instance, having a sign-off on commits.

Dev environment requires:

- node >= 16.14.0
- npm >= 6.8.0
- git >= 2.11

## Licence

Apache-2.0
