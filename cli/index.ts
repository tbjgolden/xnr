#!/usr/bin/env node
/* eslint-disable no-console */

// TODO: remove these when releasing a version that fixes this issue
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { hello } from "../lib";

const [_cmd, _fileName, ...args] = process.argv;
const arg = args.join(" ");

if (arg !== "") {
  console.log(hello(arg));
}
