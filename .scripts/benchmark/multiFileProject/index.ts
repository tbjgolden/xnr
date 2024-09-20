import { add } from "./maths/add.ts";
import { multiply } from "./maths/multiply.ts";
import { subtract } from "./maths/subtract.ts";
import { formatResult } from "./util/formatter.ts";
import { log } from "./util/logger.ts";

const a = 10;
const b = 5;

const additionResult = add(a, b);
const subtractionResult = subtract(a, b);
const multiplicationResult = multiply(a, b);

log(formatResult("Addition", a, b, additionResult));
log(formatResult("Subtraction", a, b, subtractionResult));
log(formatResult("Multiplication", a, b, multiplicationResult));
