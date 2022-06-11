import x from "test-dep";
import { fileURLToPath } from "url";

const y = fileURLToPath(await import.meta.resolve("test-dep"));

console.log(x);

console.log(y);

/*
- Only looks at main
  - if .js then if type === module ? "mjs" : "cjs"


*/
