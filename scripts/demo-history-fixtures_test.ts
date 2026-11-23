import { GREENFIELD_CHILDREN } from "./demo-child-fixtures.ts";
import {
  buildGreenfieldHistoricalTrips,
  buildGreenfieldInvoicePlans,
  GREENFIELD_DELAY_REPORTS,
  GREENFIELD_HISTORY_WINDOW,
  GREENFIELD_RESOLVED_INCIDENTS,
} from "./demo-history-fixtures.ts";

Deno.test("Greenfield history spans four complete school weeks", () => {
  const trips = buildGreenfieldHistoricalTrips();
  const weekdays = new Set(trips.map((trip) => trip.serviceDate));
  if (
    weekdays.size !== GREENFIELD_HISTORY_WINDOW.weekdays ||
    trips.length !== GREENFIELD_HISTORY_WINDOW.trips ||
    [...weekdays].some((date) => date < GREENFIELD_HISTORY_WINDOW.startDate || date > GREENFIELD_HISTORY_WINDOW.endDate)
  ) throw new Error("Expected 20 weekdays and 120 historical trips.");
});

Deno.test("historical trips cover both directions on all three routes", () => {
  const trips = buildGreenfieldHistoricalTrips();
  for (const route of ["A", "B", "C"]) {
    for (const direction of ["to_school", "from_school"]) {
      if (trips.filter((trip) => trip.routeCode === route && trip.direction === direction).length !== 20) {
        throw new Error("Every route and direction must have 20 historical trips.");
      }
    }
  }
});

Deno.test("historical trip children always match their route", () => {
  for (const trip of buildGreenfieldHistoricalTrips()) {
    if (
      trip.childIndices.length < 18 ||
      trip.childIndices.some((index) => GREENFIELD_CHILDREN[index]?.routeCode !== trip.routeCode)
    ) throw new Error("Historical trip contains a child assigned to another route.");
  }
});

Deno.test("invoice fixture totals 16 paid, 16 partial and 32 overdue", () => {
  const plans = buildGreenfieldInvoicePlans();
  const count = (status: string) => plans.filter((plan) => plan.expectedStatus === status).length;
  if (
    plans.length !== 64 ||
    count("paid") !== 16 ||
    count("partially_paid") !== 16 ||
    count("overdue") !== 32 ||
    plans.some((plan) => plan.totalMinor !== 55500 || plan.currency !== "USD")
  ) throw new Error("Invoice plan does not match the canonical finance distribution.");
});

Deno.test("invoice fixtures are linked to the canonical household guardian", () => {
  const plans = buildGreenfieldInvoicePlans();
  if (
    plans[0].guardianEmail !== "chipo.moyo@greenfield.predrive-demo.invalid" ||
    plans[1].guardianEmail !== "chipo.moyo@greenfield.predrive-demo.invalid" ||
    new Set(plans.map((plan) => plan.invoiceNumber)).size !== 64
  ) throw new Error("Invoice guardian or invoice-number mapping is not canonical.");
});

Deno.test("history includes two resolved incidents and four delay reports", () => {
  if (
    GREENFIELD_RESOLVED_INCIDENTS.length !== 2 ||
    GREENFIELD_DELAY_REPORTS.length !== 4 ||
    GREENFIELD_RESOLVED_INCIDENTS.some((incident) => incident.resolvedAt <= incident.occurredAt)
  ) throw new Error("Historical safety fixture counts or timestamps are invalid.");
});
