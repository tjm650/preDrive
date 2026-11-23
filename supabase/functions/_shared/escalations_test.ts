import {
  isValidProcessedAlertCount,
  MAX_ESCALATION_BATCH_SIZE,
} from "./escalations.ts";

Deno.test("escalation processor accepts bounded integer result counts", () => {
  if (!isValidProcessedAlertCount(0)) {
    throw new Error("Zero processed alerts is a valid result.");
  }
  if (!isValidProcessedAlertCount(MAX_ESCALATION_BATCH_SIZE)) {
    throw new Error("The batch limit is a valid result.");
  }
  if (isValidProcessedAlertCount(-1)) {
    throw new Error("Negative result counts must be rejected.");
  }
  if (isValidProcessedAlertCount(MAX_ESCALATION_BATCH_SIZE + 1)) {
    throw new Error("Counts above the batch limit must be rejected.");
  }
  if (isValidProcessedAlertCount(1.5)) {
    throw new Error("Fractional result counts must be rejected.");
  }
  if (isValidProcessedAlertCount("1")) {
    throw new Error("String result counts must be rejected.");
  }
});
