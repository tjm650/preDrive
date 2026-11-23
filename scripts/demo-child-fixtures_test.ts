import {
  DEMO_CLASS_COUNTS,
  GREENFIELD_CHILDREN,
  GREENFIELD_DEMO_SCHOOL_ID,
} from "./demo-child-fixtures.ts";

Deno.test("Greenfield child fixture contains exactly 64 fictional children", () => {
  if (GREENFIELD_CHILDREN.length !== 64) {
    throw new Error("Expected 64 child fixtures.");
  }
});

Deno.test("Greenfield child fixture distributes children across the three brief classes", () => {
  const counts = new Map<string, number>();
  for (const child of GREENFIELD_CHILDREN) {
    counts.set(child.classGroupId, (counts.get(child.classGroupId) ?? 0) + 1);
  }
  const actual = [...counts.values()].sort((a, b) => b - a);
  const expected = Object.values(DEMO_CLASS_COUNTS).sort((a, b) => b - a);
  if (actual.join(",") !== expected.join(",")) {
    throw new Error("Class distribution must be 22, 21 and 21.");
  }
});

Deno.test("Greenfield children have unique names and dates of birth", () => {
  const keys = GREENFIELD_CHILDREN.map((child) =>
    [child.firstName, child.lastName, child.dateOfBirth].join("|")
  );
  if (new Set(keys).size !== GREENFIELD_CHILDREN.length) {
    throw new Error("Child fixture contains duplicate identity tuples.");
  }
});

Deno.test("Greenfield children are assigned only to canonical routes and stops", () => {
  for (const child of GREENFIELD_CHILDREN) {
    const routeNumber = child.routeCode.charCodeAt(0) - 65;
    const routeId = [
      "10000000-0000-4000-8000-000000000301",
      "10000000-0000-4000-8000-000000000302",
      "10000000-0000-4000-8000-000000000303",
    ][routeNumber];
    const stopPrefix = ["401", "411", "421"][routeNumber];
    const stopIdNumber = Number(child.routeStopId.slice(-3));
    if (
      child.routeId !== routeId ||
      stopIdNumber < Number(stopPrefix) ||
      stopIdNumber > Number(stopPrefix) + 4
    ) {
      throw new Error("Child route or stop does not match its route.");
    }
  }
});

Deno.test("Chipo Moyo's guardian demo children are Tendai and Tadiwa", () => {
  const firstTwo = GREENFIELD_CHILDREN.slice(0, 2);
  if (
    firstTwo[0].firstName !== "Tendai" ||
    firstTwo[0].lastName !== "Moyo" ||
    firstTwo[1].firstName !== "Tadiwa" ||
    firstTwo[1].lastName !== "Moyo" ||
    firstTwo.some((child) => child.routeCode !== "A")
  ) {
    throw new Error("Guardian demo relationship is not canonical.");
  }
});

Deno.test("all children use the reserved Greenfield tenant class IDs", () => {
  const allowed = new Set([
    "10000000-0000-4000-8000-000000000101",
    "10000000-0000-4000-8000-000000000102",
    "10000000-0000-4000-8000-000000000103",
  ]);
  if (
    GREENFIELD_DEMO_SCHOOL_ID !== "10000000-0000-4000-8000-000000000001" ||
    GREENFIELD_CHILDREN.some((child) => !allowed.has(child.classGroupId))
  ) {
    throw new Error("Child fixtures contain a non-canonical tenant or class ID.");
  }
});

Deno.test("Greenfield route assignments never exceed the seeded bus capacities", () => {
  const counts = new Map<string, number>();
  for (const child of GREENFIELD_CHILDREN) {
    counts.set(child.routeCode, (counts.get(child.routeCode) ?? 0) + 1);
  }
  if (
    counts.get("A") !== 26 ||
    counts.get("B") !== 22 ||
    counts.get("C") !== 16
  ) {
    throw new Error("Expected route pupil counts of 26, 22 and 16, leaving two seats for the driver and supervisor on buses of 28, 24 and 18 seats.");
  }
});
