import type {
  Alert, Bus, Child, Incident, Invoice, InvoiceLineItem, Money, School,
  StaffMember, Trip,
} from "../../types";
import type { CurrencyCode } from "../../types/common";

export type DatabaseRow = Record<string, unknown>;

function requiredString(row: DatabaseRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid database record");
  }
  return value;
}

function optionalString(row: DatabaseRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" ? value : undefined;
}

function requiredNumber(row: DatabaseRow, key: string): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid database record");
  return parsed;
}

function requiredBoolean(row: DatabaseRow, key: string): boolean {
  if (typeof row[key] !== "boolean") throw new Error("Invalid database record");
  return row[key] as boolean;
}

function requiredCurrency(row: DatabaseRow, key: string): CurrencyCode {
  const value = requiredString(row, key);
  if (value !== "USD" && value !== "ZiG") throw new Error("Invalid database record");
  return value;
}

function timestamps(row: DatabaseRow) {
  return {
    id: requiredString(row, "id"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

function schoolId(row: DatabaseRow): string {
  return requiredString(row, "school_id");
}

export function mapSchool(row: DatabaseRow): School {
  const status = requiredString(row, "status");
  if (!["pending", "active", "suspended"].includes(status)) throw new Error("Invalid database record");
  if (requiredString(row, "timezone") !== "Africa/Harare") throw new Error("Invalid database record");
  return {
    ...timestamps(row),
    name: requiredString(row, "name"),
    status: status as School["status"],
    address: requiredString(row, "address"),
    timezone: "Africa/Harare",
    indicativeZigPerUsd: requiredNumber(row, "indicative_zig_per_usd"),
  };
}

export function mapChild(row: DatabaseRow): Child {
  const status = requiredString(row, "status");
  if (!["active", "inactive", "withdrawn"].includes(status)) throw new Error("Invalid database record");
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    firstName: requiredString(row, "first_name"),
    lastName: requiredString(row, "last_name"),
    dateOfBirth: requiredString(row, "date_of_birth"),
    classGroupId: requiredString(row, "class_group_id"),
    status: status as Child["status"],
    ...(optionalString(row, "profile_image_path")
      ? { profileImage: optionalString(row, "profile_image_path") }
      : {}),
  };
}

export function mapStaffMember(row: DatabaseRow): StaffMember {
  const role = requiredString(row, "role");
  if (!["supervisor", "driver", "teacher"].includes(role)) throw new Error("Invalid database record");
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    userId: requiredString(row, "user_id"),
    fullName: requiredString(row, "full_name"),
    role: role as StaffMember["role"],
    phone: requiredString(row, "phone"),
    active: requiredBoolean(row, "active"),
  };
}

export function mapBus(row: DatabaseRow): Bus {
  const status = requiredString(row, "status");
  if (!["active", "maintenance", "inactive"].includes(status)) throw new Error("Invalid database record");
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    registrationNumber: requiredString(row, "registration_number"),
    make: requiredString(row, "make"),
    model: requiredString(row, "model"),
    capacity: requiredNumber(row, "capacity"),
    status: status as Bus["status"],
  };
}

export function mapTrip(row: DatabaseRow): Trip {
  const direction = requiredString(row, "direction");
  const status = requiredString(row, "status");
  if (!["to_school", "from_school"].includes(direction)) throw new Error("Invalid database record");
  if (!["scheduled", "active", "completed", "cancelled", "attention_required"].includes(status)) {
    throw new Error("Invalid database record");
  }
  const supervisorId = optionalString(row, "supervisor_id");
  if (!supervisorId) throw new Error("Trip has no assigned supervisor");
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    routeId: requiredString(row, "route_id"),
    busId: requiredString(row, "bus_id"),
    supervisorId,
    driverId: requiredString(row, "driver_id"),
    direction: direction as Trip["direction"],
    status: status as Trip["status"],
    scheduledAt: requiredString(row, "scheduled_at"),
    ...(optionalString(row, "started_at") ? { startedAt: optionalString(row, "started_at") } : {}),
    ...(optionalString(row, "ended_at") ? { endedAt: optionalString(row, "ended_at") } : {}),
  };
}

export function mapAlert(row: DatabaseRow): Alert {
  const severity = requiredString(row, "severity");
  const status = requiredString(row, "status");
  if (!["info", "warning", "urgent"].includes(severity)) throw new Error("Invalid database record");
  if (!["open", "acknowledged", "resolved"].includes(status)) throw new Error("Invalid database record");
  const recipientRows = row.alert_recipients;
  const recipientUserIds = Array.isArray(recipientRows)
    ? recipientRows.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const id = (item as DatabaseRow).recipient_user_id;
        return typeof id === "string" ? [id] : [];
      })
    : [];
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    title: requiredString(row, "title"),
    message: requiredString(row, "message"),
    severity: severity as Alert["severity"],
    status: status as Alert["status"],
    recipientUserIds,
    ...(optionalString(row, "acknowledged_at")
      ? { acknowledgedAt: optionalString(row, "acknowledged_at") }
      : {}),
  };
}

export function mapIncident(row: DatabaseRow): Incident {
  const severity = requiredString(row, "severity");
  const status = requiredString(row, "status");
  if (!["low", "medium", "high", "critical"].includes(severity)) throw new Error("Invalid database record");
  if (!["open", "investigating", "resolved"].includes(status)) throw new Error("Invalid database record");
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    title: requiredString(row, "title"),
    description: requiredString(row, "description"),
    severity: severity as Incident["severity"],
    status: status as Incident["status"],
    ...(optionalString(row, "trip_id") ? { tripId: optionalString(row, "trip_id") } : {}),
    ...(optionalString(row, "child_id") ? { childId: optionalString(row, "child_id") } : {}),
    reportedBy: requiredString(row, "reported_by"),
    occurredAt: requiredString(row, "occurred_at"),
  };
}

function moneyFromMinor(minor: unknown, currency: CurrencyCode): Money {
  const amount = typeof minor === "number" ? minor : Number(minor);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid database record");
  return { amount: amount / 100, currency };
}

export function mapInvoice(row: DatabaseRow): Invoice {
  const status = requiredString(row, "status");
  if (!["draft", "issued", "partially_paid", "paid", "overdue", "void"].includes(status)) {
    throw new Error("Invalid database record");
  }
  const currency = requiredCurrency(row, "currency");
  const lines = row.invoice_lines;
  const items: InvoiceLineItem[] = Array.isArray(lines)
    ? lines.map((item) => {
        if (typeof item !== "object" || item === null) throw new Error("Invalid database record");
        const line = item as DatabaseRow;
        return {
          id: requiredString(line, "id"),
          description: requiredString(line, "description"),
          amount: moneyFromMinor(line.line_total_minor, currency),
        };
      })
    : [];
  return {
    ...timestamps(row),
    schoolId: schoolId(row),
    childId: requiredString(row, "child_id"),
    guardianUserId: requiredString(row, "guardian_user_id"),
    invoiceNumber: requiredString(row, "invoice_number"),
    items,
    total: moneyFromMinor(row.total_minor, currency),
    balance: moneyFromMinor(row.balance_minor, currency),
    status: status as Invoice["status"],
    dueDate: requiredString(row, "due_date"),
  };
}
