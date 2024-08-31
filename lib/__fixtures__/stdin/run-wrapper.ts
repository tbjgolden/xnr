import { run } from '../../index';

await run({
  filePath: 'lib/__fixtures__/stdin/index.ts',
  outputDirectory: 'node_modules/.cache/xnr-run-test',
})
