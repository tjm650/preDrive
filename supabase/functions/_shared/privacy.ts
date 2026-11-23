export const DATA_EXPORT_BUCKET = "exports";
export const DATA_EXPORT_TTL_DAYS = 7;
export const GPS_HISTORY_TTL_DAYS = 30;
export const TERMINAL_DELIVERY_TTL_DAYS = 90;
export const RETENTION_BATCH_SIZE = 5000;
export const MAX_DATA_EXPORT_BYTES = 20 * 1024 * 1024;
export const DATA_EXPORT_SIGNED_URL_SECONDS = 60;

export function dataExportObjectPath(
  schoolId: string,
  requestId: string,
): string {
  return `${schoolId}/privacy/${requestId}.json`;
}

export function isValidDeletionRequestId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
