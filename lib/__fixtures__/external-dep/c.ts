import { transform } from 'sucrase';
import { lintTime } from 'lint-time';

if (typeof lintTime === 'function') {
  console.log(
    transform("console.log('hello world!' as string)", {
      transforms: ["typescript"]
    }).code
  );
}
