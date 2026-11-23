export type DemoChildFixture = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  classGroupId: string;
  routeId: string;
  routeStopId: string;
  routeCode: "A" | "B" | "C";
};

export const GREENFIELD_DEMO_SCHOOL_ID =
  "10000000-0000-4000-8000-000000000001";

export const DEMO_CLASS_IDS = {
  sunbeams: "10000000-0000-4000-8000-000000000101",
  littleStars: "10000000-0000-4000-8000-000000000102",
  explorers: "10000000-0000-4000-8000-000000000103",
} as const;

const ROUTES = [
  {
    code: "A",
    routeId: "10000000-0000-4000-8000-000000000301",
    stopIds: [
      "10000000-0000-4000-8000-000000000401",
      "10000000-0000-4000-8000-000000000402",
      "10000000-0000-4000-8000-000000000403",
      "10000000-0000-4000-8000-000000000404",
      "10000000-0000-4000-8000-000000000405",
    ],
  },
  {
    code: "B",
    routeId: "10000000-0000-4000-8000-000000000302",
    stopIds: [
      "10000000-0000-4000-8000-000000000411",
      "10000000-0000-4000-8000-000000000412",
      "10000000-0000-4000-8000-000000000413",
      "10000000-0000-4000-8000-000000000414",
      "10000000-0000-4000-8000-000000000415",
    ],
  },
  {
    code: "C",
    routeId: "10000000-0000-4000-8000-000000000303",
    stopIds: [
      "10000000-0000-4000-8000-000000000421",
      "10000000-0000-4000-8000-000000000422",
      "10000000-0000-4000-8000-000000000423",
      "10000000-0000-4000-8000-000000000424",
      "10000000-0000-4000-8000-000000000425",
    ],
  },
] as const;

const FIRST_NAMES = [
  "Tendai", "Rutendo", "Nomsa", "Tafara",
  "Anesu", "Thando", "Kudzai", "Rumbidzai",
  "Tinashe", "Nyasha", "Lerato", "Munashe",
  "Simba", "Nokuthula", "Tariro", "Lindokuhle",
] as const;

const LAST_NAMES = [
  "Moyo", "Chikwanha", "Dube", "Ndlovu",
] as const;

function dateOfBirth(index: number, classIndex: number): string {
  const year = [2023, 2022, 2021][classIndex];
  const month = (index % 12) + 1;
  const day = ((index * 3) % 20) + 1;
  return [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export const GREENFIELD_CHILDREN: readonly DemoChildFixture[] =
  Array.from({ length: 64 }, (_, index) => {
    const classIndex = index < 22 ? 0 : index < 43 ? 1 : 2;
    const classGroupId = [
      DEMO_CLASS_IDS.sunbeams,
      DEMO_CLASS_IDS.littleStars,
      DEMO_CLASS_IDS.explorers,
    ][classIndex];
    const routeIndex = index < 2
      ? 0
      : (index - 2) < 48
      ? (index - 2) % 3
      : (index - 2) < 56
      ? 0
      : 1;
    const route = ROUTES[routeIndex];
    const stopIndex = Math.floor(index / ROUTES.length) % route.stopIds.length;

    // The first two records are the guardian demo account's children.
    const name = index === 0
      ? { firstName: "Tendai", lastName: "Moyo" }
      : index === 1
      ? { firstName: "Tadiwa", lastName: "Moyo" }
      : {
        firstName: FIRST_NAMES[(index - 1) % FIRST_NAMES.length],
        lastName: LAST_NAMES[Math.floor((index - 1) / FIRST_NAMES.length)],
      };

    return {
      ...name,
      dateOfBirth: dateOfBirth(index, classIndex),
      classGroupId,
      routeId: route.routeId,
      routeStopId: route.stopIds[stopIndex],
      routeCode: route.code,
    };
  });

export const DEMO_CLASS_COUNTS = {
  sunbeams: 22,
  littleStars: 21,
  explorers: 21,
} as const;
