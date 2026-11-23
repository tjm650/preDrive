import { isValidDemoHistoryResult } from "./seed-greenfield-history.ts";

Deno.test("demo history runner accepts the exact canonical fixture counts", () => {
  if (!isValidDemoHistoryResult({
    trips: 120,
    tripChildren: 2560,
    invoices: 64,
    simulatedPayments: 32,
    receipts: 32,
    resolvedIncidents: 2,
    delayReports: 4,
  })) throw new Error("Expected canonical demo history result.");
});

Deno.test("demo history runner rejects partial, inflated and malformed results", () => {
  const invalid = [
    null,
    {},
    { trips: 119, tripChildren: 2560, invoices: 64, simulatedPayments: 32, receipts: 32, resolvedIncidents: 2, delayReports: 4 },
    { trips: 120, tripChildren: 2560, invoices: 64, simulatedPayments: 33, receipts: 32, resolvedIncidents: 2, delayReports: 4 },
    { trips: "120", tripChildren: 2560, invoices: 64, simulatedPayments: 32, receipts: 32, resolvedIncidents: 2, delayReports: 4 },
  ];
  if (invalid.some((value) => isValidDemoHistoryResult(value))) {
    throw new Error("Malformed history result was accepted.");
  }
});
