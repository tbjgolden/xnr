import { log } from "./log";
import data from "./data.json";

const typedFn = (str: string) => log(str);
typedFn("hello world");

log(data);
