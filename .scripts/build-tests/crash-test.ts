import { log } from "./log";

// ---

log("log");
throw new Error("crash-test" as string);
