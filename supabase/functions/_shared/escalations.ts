export const MAX_ESCALATION_BATCH_SIZE = 100;

export function isValidProcessedAlertCount(
  value: unknown,
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_ESCALATION_BATCH_SIZE;
}
