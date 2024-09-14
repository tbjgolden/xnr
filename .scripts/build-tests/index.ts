import data from "./data.json";
import { log } from "./log";

const typedFn = (str: string) => log(str);
typedFn("hello world");

log(data);
