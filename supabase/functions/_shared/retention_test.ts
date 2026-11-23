import { assertEquals } from "jsr:@std/assert@1.0.14";
import {
  DATA_EXPORT_TTL_DAYS,
  GPS_HISTORY_TTL_DAYS,
  TERMINAL_DELIVERY_TTL_DAYS,
} from "./privacy.ts";
import { retentionCutoff } from "./retention.ts";

Deno.test("approved retention periods remain explicit and bounded", () => {
  assertEquals(GPS_HISTORY_TTL_DAYS, 30);
  assertEquals(DATA_EXPORT_TTL_DAYS, 7);
  assertEquals(TERMINAL_DELIVERY_TTL_DAYS, 90);
});

Deno.test("retention cutoff uses exact elapsed-day arithmetic", () => {
  const now = new Date("2026-11-23T12:00:00.000Z");
  assertEquals(
    retentionCutoff(30, now),
    "2026-10-24T12:00:00.000Z",
  );
  assertEquals(
    retentionCutoff(7, now),
    "2026-11-16T12:00:00.000Z",
  );
});
