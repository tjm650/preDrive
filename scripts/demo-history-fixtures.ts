import { GREENFIELD_CHILDREN } from "./demo-child-fixtures.ts";
import { GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX } from "./demo-identity-fixtures.ts";

export type DemoHistoricalTrip = {
  scheduleId: string;
  routeId: string;
  routeCode: "A" | "B" | "C";
  direction: "to_school" | "from_school";
  serviceDate: string;
  departureTime: "07:00:00" | "15:00:00";
  generationKey: string;
  childIndices: number[];
};

export type DemoInvoicePlan = {
  childIndex: number;
  guardianEmail: string;
  invoiceNumber: string;
  currency: "USD";
  dueDate: string;
  totalMinor: 55500;
  plannedPaymentMinor: number;
  expectedStatus: "paid" | "partially_paid" | "overdue";
};

const ROUTES = [
  {
    code: "A" as const,
    routeId: "10000000-0000-4000-8000-000000000301",
    toSchoolScheduleId: "10000000-0000-4000-8000-000000000701",
    fromSchoolScheduleId: "10000000-0000-4000-8000-000000000702",
  },
  {
    code: "B" as const,
    routeId: "10000000-0000-4000-8000-000000000302",
    toSchoolScheduleId: "10000000-0000-4000-8000-000000000703",
    fromSchoolScheduleId: "10000000-0000-4000-8000-000000000704",
  },
  {
    code: "C" as const,
    routeId: "10000000-0000-4000-8000-000000000303",
    toSchoolScheduleId: "10000000-0000-4000-8000-000000000705",
    fromSchoolScheduleId: "10000000-0000-4000-8000-000000000706",
  },
] as const;

function weekdaysBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(start + "T00:00:00.000Z");
  const final = new Date(end + "T00:00:00.000Z");
  while (cursor <= final) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function buildGreenfieldHistoricalTrips(): DemoHistoricalTrip[] {
  const dates = weekdaysBetween("2026-10-26", "2026-11-20");
  return dates.flatMap((serviceDate) =>
    ROUTES.flatMap((route) => {
      const children = GREENFIELD_CHILDREN
        .map((child, childIndex) => ({ child, childIndex }))
        .filter(({ child }) => child.routeCode === route.code)
        .map(({ childIndex }) => childIndex);
      return [
        {
          scheduleId: route.toSchoolScheduleId,
          routeId: route.routeId,
          routeCode: route.code,
          direction: "to_school" as const,
          serviceDate,
          departureTime: "07:00:00" as const,
          generationKey: "greenfield-history:" + route.toSchoolScheduleId + ":" + serviceDate,
          childIndices: children,
        },
        {
          scheduleId: route.fromSchoolScheduleId,
          routeId: route.routeId,
          routeCode: route.code,
          direction: "from_school" as const,
          serviceDate,
          departureTime: "15:00:00" as const,
          generationKey: "greenfield-history:" + route.fromSchoolScheduleId + ":" + serviceDate,
          childIndices: children,
        },
      ];
    })
  );
}

export function buildGreenfieldInvoicePlans(): DemoInvoicePlan[] {
  return GREENFIELD_CHILDREN.map((child, childIndex) => {
    const cohort = childIndex % 4;
    const expectedStatus = cohort === 0
      ? "paid"
      : cohort === 1
      ? "partially_paid"
      : "overdue";
    return {
      childIndex,
      guardianEmail: GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX[childIndex],
      invoiceNumber: "GF-2026-T4-" + String(childIndex + 1).padStart(3, "0"),
      currency: "USD",
      dueDate: cohort === 2 ? "2026-11-06" : cohort === 3 ? "2026-11-13" : "2026-11-20",
      totalMinor: 55500,
      plannedPaymentMinor: cohort === 0 ? 55500 : cohort === 1 ? 27750 : 0,
      expectedStatus,
    };
  });
}

export const GREENFIELD_RESOLVED_INCIDENTS = [
  {
    reference: "GF-INC-001",
    title: "Minor delay at Borrowdale Road",
    description: "Traffic congestion delayed the afternoon pickup. Guardians were notified and all children were accounted for.",
    severity: "low",
    routeCode: "A",
    occurredAt: "2026-11-04T13:20:00+02:00",
    resolvedAt: "2026-11-04T14:05:00+02:00",
  },
  {
    reference: "GF-INC-002",
    title: "Vehicle door inspection",
    description: "A door sensor warning was inspected before departure. The bus was cleared for service after the latch was checked.",
    severity: "medium",
    routeCode: "B",
    occurredAt: "2026-11-12T06:40:00+02:00",
    resolvedAt: "2026-11-12T07:10:00+02:00",
  },
] as const;

export const GREENFIELD_DELAY_REPORTS = [
  { reference: "GF-DELAY-001", routeCode: "A", date: "2026-10-29", minutes: 12, reason: "traffic" },
  { reference: "GF-DELAY-002", routeCode: "B", date: "2026-11-03", minutes: 8, reason: "weather" },
  { reference: "GF-DELAY-003", routeCode: "C", date: "2026-11-10", minutes: 15, reason: "roadworks" },
  { reference: "GF-DELAY-004", routeCode: "A", date: "2026-11-18", minutes: 6, reason: "traffic" },
] as const;

export const GREENFIELD_HISTORY_WINDOW = {
  startDate: "2026-10-26",
  endDate: "2026-11-20",
  weekdays: 20,
  trips: 120,
  invoiceCount: 64,
  paidInvoices: 16,
  partialInvoices: 16,
  overdueInvoices: 32,
} as const;
