import {
  addCalendarDays,
  dateInTimeZone,
  paymentReminderCopy,
  paymentReminderStage,
  receiptRequestSchema,
  refundRequestSchema,
} from "./finance.ts";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const PAYMENT_ID = "22222222-2222-4222-8222-222222222222";

Deno.test("refund request validates integer minor units and bounded reason", () => {
  const result = refundRequestSchema.parse({
    schoolId: SCHOOL_ID,
    paymentId: PAYMENT_ID,
    amountMinor: 12345,
    reason: "Duplicate payment",
  });
  if (result.amountMinor !== 12345) throw new Error("Refund amount changed.");

  for (const amountMinor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    if (refundRequestSchema.safeParse({
      schoolId: SCHOOL_ID,
      paymentId: PAYMENT_ID,
      amountMinor,
      reason: "Valid reason",
    }).success) {
      throw new Error("Invalid refund amount was accepted.");
    }
  }

  if (refundRequestSchema.safeParse({
    schoolId: SCHOOL_ID,
    paymentId: PAYMENT_ID,
    amountMinor: 100,
    reason: "x",
  }).success) {
    throw new Error("An undersized refund reason was accepted.");
  }
});

Deno.test("receipt request accepts only a payment identifier", () => {
  if (!receiptRequestSchema.safeParse({ paymentId: PAYMENT_ID }).success) {
    throw new Error("Valid receipt request was rejected.");
  }
  if (receiptRequestSchema.safeParse({
    paymentId: PAYMENT_ID,
    guardianUserId: SCHOOL_ID,
  }).success) {
    throw new Error("Caller-supplied identity was accepted.");
  }
});

Deno.test("school-local date conversion respects Africa/Harare", () => {
  const instant = new Date("2026-11-23T22:30:00.000Z");
  if (dateInTimeZone(instant, "Africa/Harare") !== "2026-11-24") {
    throw new Error("Harare local date was not calculated correctly.");
  }
});

Deno.test("calendar date offsets handle month and year boundaries", () => {
  if (addCalendarDays("2026-01-01", -1) !== "2025-12-31") {
    throw new Error("Negative date offset crossed the year incorrectly.");
  }
  if (addCalendarDays("2026-02-27", 3) !== "2026-03-02") {
    throw new Error("Positive date offset crossed the month incorrectly.");
  }
});

Deno.test("payment reminder stages are precise and deduplicable", () => {
  const cases: Array<[number, string]> = [
    [3, "due_soon"],
    [0, "due_today"],
    [-7, "overdue_7_days"],
    [-14, "overdue_14_days"],
    [-30, "overdue_30_days"],
  ];

  for (const [offset, expected] of cases) {
    const dueDate = addCalendarDays("2026-11-23", offset);
    if (paymentReminderStage(dueDate, "2026-11-23") !== expected) {
      throw new Error("Incorrect payment reminder stage for offset " + offset);
    }
  }

  if (paymentReminderStage("2026-11-22", "2026-11-23") !== null) {
    throw new Error("An unplanned daily overdue reminder was generated.");
  }
});

Deno.test("payment reminder copy formats USD and ZiG in minor units", () => {
  const usd = paymentReminderCopy({
    stage: "due_today",
    invoiceNumber: "GF-2026-001",
    amountMinor: 12345,
    currency: "USD",
    dueDate: "2026-11-23",
  });
  const zig = paymentReminderCopy({
    stage: "due_soon",
    invoiceNumber: "GF-2026-002",
    amountMinor: 100050,
    currency: "ZiG",
    dueDate: "2026-11-26",
  });

  if (!usd.message.includes("US$123.45")) {
    throw new Error("USD reminder amount was formatted incorrectly.");
  }
  if (!zig.message.includes("ZiG 1,000.50")) {
    throw new Error("ZiG reminder amount was formatted incorrectly.");
  }
});
