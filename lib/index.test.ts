import { hello } from "./index.js";

test("hello says hello", () => {
  expect(hello("world")).toBe(`Hello world!`);
});
