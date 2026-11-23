import {
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
  const pins = new Set<string>();
  for (let child = 0; child < 64; child += 1) {
    for (let sequence = 0; sequence < 2; sequence += 1) {
      const pin = await deriveDemoCollectorPin(secret, child, sequence);
      if (!/^\d{8}$/.test(pin)) throw new Error("Expected an eight-digit collector PIN.");
      if (pins.has(pin)) throw new Error("Derived demo collector PIN collision detected.");
      pins.add(pin);
      if (pin !== await deriveDemoCollectorPin(secret, child, sequence)) {
        throw new Error("Collector PIN derivation is not deterministic.");
      }
    }
  }
  if (pins.size !== 128) throw new Error("Expected 128 distinct collector PINs.");
});
