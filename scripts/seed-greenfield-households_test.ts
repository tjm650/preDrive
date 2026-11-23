import { validateCollectorPin } from "./seed-greenfield-households.ts";

Deno.test("demo collector PIN accepts 4 to 8 digits", () => {
  for (const pin of ["1234", "000000", "12345678"]) {
    if (!validateCollectorPin(pin)) throw new Error("Expected valid collector PIN.");
  }
});

Deno.test("demo collector PIN rejects weak formats and wrong lengths", () => {
  for (const pin of ["123", "123456789", "12a4", " 1234", "1234 "]) {
    if (validateCollectorPin(pin)) throw new Error("Expected invalid collector PIN.");
  }
});
