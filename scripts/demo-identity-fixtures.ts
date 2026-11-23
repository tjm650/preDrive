import { GREENFIELD_CHILDREN } from "./demo-child-fixtures.ts";

export type DemoIdentity = {
  email: string;
  fullName: string;
  phone: string;
  language: "en" | "sn" | "nd";
  role: "guardian" | "supervisor" | "driver" | "teacher";
  fixtureOnly: true;
  staffSequence?: number;
};

const GUARDIAN_NAMES = [
  ["Chipo", "Moyo"], ["Rutendo", "Chikwanha"], ["Nomsa", "Dube"], ["Tafara", "Ndlovu"],
  ["Anesu", "Sibanda"], ["Thando", "Ncube"], ["Kudzai", "Muchengeti"], ["Rumbidzai", "Moyo"],
  ["Tinashe", "Chari"], ["Nyasha", "Dube"], ["Lerato", "Ndlovu"], ["Munashe", "Sibanda"],
  ["Simba", "Ncube"], ["Nokuthula", "Moyo"], ["Tariro", "Chikwanha"], ["Lindokuhle", "Dube"],
  ["Farai", "Ndlovu"], ["Memory", "Sibanda"], ["Blessing", "Ncube"], ["Tendai", "Moyo"],
  ["Grace", "Dube"], ["Nomalanga", "Ndlovu"], ["Tapiwa", "Sibanda"], ["Rudo", "Ncube"],
  ["Shingai", "Moyo"], ["Vimbai", "Dube"], ["Sihle", "Ndlovu"], ["Munashe", "Chikwanha"],
  ["Patience", "Sibanda"], ["Tawanda", "Ncube"], ["Lindiwe", "Moyo"], ["Kundai", "Dube"],
] as const;

const STAFF_FIXTURES: readonly DemoIdentity[] = [
  { role: "supervisor", email: "supervisor.route-b@greenfield.predrive-demo.invalid", fullName: "Kudzai Chari", phone: "+263771000201", language: "en", fixtureOnly: true, staffSequence: 2 },
  { role: "supervisor", email: "supervisor.route-c@greenfield.predrive-demo.invalid", fullName: "Nomalanga Dube", phone: "+263771000202", language: "nd", fixtureOnly: true, staffSequence: 3 },
  { role: "driver", email: "driver.route-b@greenfield.predrive-demo.invalid", fullName: "Tapiwa Ncube", phone: "+263771000203", language: "en", fixtureOnly: true, staffSequence: 2 },
  { role: "driver", email: "driver.route-c@greenfield.predrive-demo.invalid", fullName: "Blessing Moyo", phone: "+263771000204", language: "sn", fixtureOnly: true, staffSequence: 3 },
  { role: "teacher", email: "teacher.little-stars@greenfield.predrive-demo.invalid", fullName: "Grace Sibanda", phone: "+263771000205", language: "en", fixtureOnly: true, staffSequence: 2 },
  { role: "teacher", email: "teacher.explorers@greenfield.predrive-demo.invalid", fullName: "Memory Chikwanha", phone: "+263771000206", language: "sn", fixtureOnly: true, staffSequence: 3 },
  { role: "teacher", email: "teacher.class-4@greenfield.predrive-demo.invalid", fullName: "Lindiwe Moyo", phone: "+263771000207", language: "nd", fixtureOnly: true, staffSequence: 4 },
  { role: "teacher", email: "teacher.class-5@greenfield.predrive-demo.invalid", fullName: "Tendai Ncube", phone: "+263771000208", language: "en", fixtureOnly: true, staffSequence: 5 },
  { role: "teacher", email: "teacher.class-6@greenfield.predrive-demo.invalid", fullName: "Nyasha Dube", phone: "+263771000209", language: "sn", fixtureOnly: true, staffSequence: 6 },
] as const;

export const GREENFIELD_GUARDIAN_FIXTURES: readonly DemoIdentity[] =
  GUARDIAN_NAMES.slice(1).map(([first, last], index) => ({
    role: "guardian",
    email: "guardian.household." + String(index + 2).padStart(2, "0") + "@greenfield.predrive-demo.invalid",
    fullName: "Mr/Mrs " + first + " " + last,
    phone: "+263771" + String(100210 + index).slice(-6),
    language: index % 3 === 0 ? "en" : index % 3 === 1 ? "sn" : "nd",
    fixtureOnly: true,
  }));

export const GREENFIELD_STAFF_FIXTURES = STAFF_FIXTURES;

export const GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX: readonly string[] =
  GREENFIELD_CHILDREN.map((_, index) => {
    const household = Math.floor(index / 2);
    return household === 0
      ? "chipo.moyo@greenfield.predrive-demo.invalid"
      : "guardian.household." + String(household + 1).padStart(2, "0") + "@greenfield.predrive-demo.invalid";
  });

export const GREENFIELD_COLLECTORS_PER_CHILD = 2;

export function isGreenfieldFixtureEmail(email: string): boolean {
  return email.endsWith("@greenfield.predrive-demo.invalid");
}
