export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  functionName?: string;
  status?: number;
  durationMs?: number;
  errorCode?: string;
  outcome?: "success" | "rejected" | "failed";
}

function write(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(fields.requestId ? { request_id: fields.requestId } : {}),
    ...(fields.functionName ? { function: fields.functionName } : {}),
    ...(fields.status !== undefined ? { status: fields.status } : {}),
    ...(fields.durationMs !== undefined
      ? { duration_ms: Math.max(0, Math.round(fields.durationMs)) }
      : {}),
    ...(fields.errorCode ? { error_code: fields.errorCode } : {}),
    ...(fields.outcome ? { outcome: fields.outcome } : {}),
  };

  const serialized = JSON.stringify(record);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export const logger = {
  info(event: string, fields?: LogFields): void {
    write("info", event, fields);
  },
  warn(event: string, fields?: LogFields): void {
    write("warn", event, fields);
  },
  error(event: string, fields?: LogFields): void {
    write("error", event, fields);
  },
};
