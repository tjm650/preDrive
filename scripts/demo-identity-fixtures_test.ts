import {
  GREENFIELD_COLLECTORS_PER_CHILD,
  GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX,
  GREENFIELD_GUARDIAN_FIXTURES,
  GREENFIELD_STAFF_FIXTURES,
  isGreenfieldFixtureEmail,
} from "./demo-identity-fixtures.ts";

Deno.test("Greenfield has 32 household guardian identities including Chipo", () => {
  if (
    GREENFIELD_GUARDIAN_FIXTURES.length !== 31 ||
    GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX.length !== 64 ||
    GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX[0] !== "chipo.moyo@greenfield.predrive-demo.invalid" ||
    GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX[1] !== "chipo.moyo@greenfield.predrive-demo.invalid"
  ) throw new Error("Expected 32 guardian households with Chipo linked to the first two children.");
});

Deno.test("all remaining households receive one guardian for each sibling pair", () => {
  for (let index = 0; index < 64; index += 2) {
    if (GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX[index] !== GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX[index + 1]) {
      throw new Error("Sibling household mapping is inconsistent.");
    }
  }
});

Deno.test("staff fixture completes three supervisors, three drivers and six teachers", () => {
  const counts = new Map<string, number>();
  for (const person of GREENFIELD_STAFF_FIXTURES) counts.set(person.role, (counts.get(person.role) ?? 0) + 1);
  if (counts.get("supervisor") !== 2 || counts.get("driver") !== 2 || counts.get("teacher") !== 5) {
    throw new Error("Expected nine supporting staff identities; primary staff are provisioned separately.");
  }
});

Deno.test("supporting fixture accounts cannot use a real email domain", () => {
  const all = [...GREENFIELD_GUARDIAN_FIXTURES, ...GREENFIELD_STAFF_FIXTURES];
  if (all.some((person) => !isGreenfieldFixtureEmail(person.email))) throw new Error("Fixture identity escaped the reserved .invalid domain.");
});

Deno.test("all generated fixture phone numbers are unique Zimbabwean mobile numbers", () => {
  const people = [...GREENFIELD_GUARDIAN_FIXTURES, ...GREENFIELD_STAFF_FIXTURES];
  const phones = people.map((person) => person.phone);
  if (new Set(phones).size !== phones.length || phones.some((phone) => !/^\+2637[178][0-9]{7}$/.test(phone))) {
    throw new Error("Fixture phone numbers must be unique +263 mobile numbers.");
  }
});

Deno.test("two approved collectors are planned for each pupil", () => {
  if (GREENFIELD_COLLECTORS_PER_CHILD !== 2) throw new Error("The canonical fixture must provide two collectors per child.");
});
