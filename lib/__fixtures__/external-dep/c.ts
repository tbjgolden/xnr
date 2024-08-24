import { parse } from 'espree';
import { transform } from 'sucrase';
import { lintTime } from 'lint-time';

if (typeof lintTime === 'function') {
  console.log(parse(
    transform("console.log('hello world!' as string)", {
      transforms: ["typescript"]
    }).code
  ).type);
}
