import { transform } from "./index.ts";

test("transform", async () => {
  expect(
    await transform({
      code: `
    export const log = (str: string) => {
      console.log(str);
    };
  `,
    })
  ).toBe(`
    export const log = (str) => {
      console.log(str);
    };
  `);
});
