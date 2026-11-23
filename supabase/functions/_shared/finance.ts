import { z } from "./validation.ts";

export const refundRequestSchema = z.object({
  schoolId: z.string().uuid(),
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  reason: z.string().trim().min(2).max(1000),
}).strict();

export type RefundRequest = z.infer<typeof refundRequestSchema>;

export const receiptRequestSchema = z.object({
  paymentId: z.string().uuid(),
}).strict();

export type PaymentReminderStage =
  | "due_soon"
  | "due_today"
  | "overdue_7_days"
  | "overdue_14_days"
  | "overdue_30_days";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseCalendarDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("A calendar date must use YYYY-MM-DD.");
  }

  const timestamp = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError("A valid calendar date is required.");
  }

  return timestamp;
}

export function dateInTimeZone(
  instant: Date,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  if (!values.year || !values.month || !values.day) {
    throw new RangeError("The school time zone could not be resolved.");
  }

  return values.year + "-" + values.month + "-" + values.day;
}

export function addCalendarDays(date: string, days: number): string {
  if (!Number.isInteger(days) || Math.abs(days) > 3660) {
    throw new RangeError("Calendar day offset is outside the supported range.");
  }

  return new Date(parseCalendarDate(date) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function paymentReminderStage(
  dueDate: string,
  today: string,
): PaymentReminderStage | null {
  const daysUntilDue = (parseCalendarDate(dueDate) - parseCalendarDate(today)) / DAY_MS;

  switch (daysUntilDue) {
    case 3:
      return "due_soon";
    case 0:
      return "due_today";
    case -7:
      return "overdue_7_days";
    case -14:
      return "overdue_14_days";
    case -30:
      return "overdue_30_days";
    default:
      return null;
  }
}

export function paymentReminderCopy(input: {
  stage: PaymentReminderStage;
  invoiceNumber: string;
  amountMinor: number;
  currency: "USD" | "ZiG";
  dueDate: string;
}): { title: string; message: string } {
  const amount = (input.amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const money = input.currency === "USD" ? "US$" + amount : "ZiG " + amount;

  switch (input.stage) {
    case "due_soon":
      return {
        title: "School fee due soon",
        message: "Invoice " + input.invoiceNumber + " has an outstanding balance of " +
          money + " and is due on " + input.dueDate + ".",
      };
    case "due_today":
      return {
        title: "School fee due today",
        message: "Invoice " + input.invoiceNumber + " has an outstanding balance of " +
          money + " due today.",
      };
    case "overdue_7_days":
    case "overdue_14_days":
    case "overdue_30_days":
      return {
        title: "School fee payment overdue",
        message: "Invoice " + input.invoiceNumber + " is overdue. The outstanding balance is " +
          money + ". Please contact the school if you need assistance.",
      };
  }
}
