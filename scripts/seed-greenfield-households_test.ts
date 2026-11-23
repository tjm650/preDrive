import {
  buildDemoCollectorPins,
  deriveDemoCollectorPin,
  validateCollectorPin,
  validateCollectorPinSecret,
} from "./seed-greenfield-households.ts";

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

Deno.test("collector PIN derivation secret must be long and free of control characters", () => {
  if (!validateCollectorPinSecret("a".repeat(32))) throw new Error("Expected a valid high-entropy secret shape.");
  for (const value of ["short", "a".repeat(31), "a".repeat(31) + "\n"]) {
    if (validateCollectorPinSecret(value)) throw new Error("Expected invalid collector PIN secret.");
  }
});

Deno.test("each Greenfield collector receives a stable, distinct eight-digit PIN", async () => {
  const secret = "greenfield-demo-pin-secret-for-ci-only-2026";
  const matrix = await buildDemoCollectorPins(secret);
  const pins = matrix.flat();
  if (
    matrix.length !== 64 ||
    matrix.some((childPins) => childPins.length !== 2) ||
    pins.length !== 128 ||
    new Set(pins).size !== 128 ||
    pins.some((pin) => !/^\d{8}$/.test(pin))
  ) throw new Error("Expected 128 distinct eight-digit collector PINs.");
  if (pins[0] !== await deriveDemoCollectorPin(secret, 0, 0)) {
    throw new Error("Collector PIN derivation is not deterministic.");
  }
});
