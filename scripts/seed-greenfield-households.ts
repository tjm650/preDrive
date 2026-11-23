import {
  GREENFIELD_CHILDREN,
  GREENFIELD_DEMO_SCHOOL_ID,
} from "./demo-child-fixtures.ts";
import {
  GREENFIELD_COLLECTORS_PER_CHILD,
  GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX,
  GREENFIELD_GUARDIAN_FIXTURES,
  GREENFIELD_STAFF_FIXTURES,
} from "./demo-identity-fixtures.ts";

const SEED_MARKER = "greenfield-demo-fixture-v1";
const COLLECTOR_FIRST_NAMES = [
  "Rudo", "Tendai", "Memory", "Tapiwa", "Grace", "Blessing", "Kudzai", "Nomalanga",
  "Farai", "Nomsa", "Tinashe", "Vimbai", "Lindiwe", "Nyasha", "Sihle", "Tawanda",
] as const;
const COLLECTOR_LAST_NAMES = [
  "Moyo", "Dube", "Ndlovu", "Sibanda", "Ncube", "Chikwanha", "Chari", "Muchengeti",
] as const;
const ADMIN_EMAIL = "admin@greenfield.predrive-demo.invalid";
const CHIPO_EMAIL = "chipo.moyo@greenfield.predrive-demo.invalid";

type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

type Profile = { id: string; email: string | null; full_name: string; phone: string | null };
type Membership = { id: string; role: string; active: boolean };
type Staff = { id: string; role: string; full_name: string; phone: string; active: boolean };
type ChildRow = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  class_group_id: string;
};
type CollectorRow = { id: string; child_id: string; full_name: string; phone: string; active: boolean };
type RouteAssignment = { id: string; route_id: string; route_stop_id: string; active: boolean };

type RuntimeConfig = {
  url: string;
  serviceKey: string;
  anonKey: string;
  adminPassword: string;
  collectorPinSecret: string;
};

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function projectOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("SUPABASE_URL must use HTTPS outside local development.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("SUPABASE_URL must not contain credentials, query parameters or a fragment.");
  }
  return parsed.origin;
}

export function validateCollectorPin(value: string): boolean {
  return /^[0-9]{4,8}$/.test(value);
}

export function validateCollectorPinSecret(value: string): boolean {
  return value.length >= 32 && !/[\u0000-\u001f\u007f]/.test(value);
}

export async function buildDemoCollectorPins(secret: string): Promise<string[][]> {
  if (!validateCollectorPinSecret(secret)) {
    throw new Error("Invalid demo collector PIN derivation secret.");
  }
  const pins: string[][] = [];
  const unique = new Set<string>();
  for (let childIndex = 0; childIndex < 64; childIndex += 1) {
    const childPins: string[] = [];
    for (let sequence = 0; sequence < GREENFIELD_COLLECTORS_PER_CHILD; sequence += 1) {
      const pin = await deriveDemoCollectorPin(secret, childIndex, sequence);
      if (unique.has(pin)) {
        throw new Error("Collector PIN derivation collision detected; no fixture mutation was started.");
      }
      unique.add(pin);
      childPins.push(pin);
    }
    pins.push(childPins);
  }
  return pins;
}

export async function deriveDemoCollectorPin(
  secret: string,
  childIndex: number,
  sequence: number,
): Promise<string> {
  if (!validateCollectorPinSecret(secret) || !Number.isInteger(childIndex) ||
    childIndex < 0 || childIndex >= 64 || !Number.isInteger(sequence) ||
    sequence < 0 || sequence >= GREENFIELD_COLLECTORS_PER_CHILD) {
    throw new Error("Invalid demo collector PIN derivation input.");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("greenfield-collector:" + childIndex + ":" + sequence),
  ));
  const value = new DataView(digest.buffer, digest.byteOffset, digest.byteLength).getUint32(0, false);
  return String(value % 100000000).padStart(8, "0");
}

function randomFixturePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return "Gf!" + hex + "7a";
}

class GreenfieldSeedApi {
  readonly origin: string;
  readonly serviceKey: string;
  readonly anonKey: string;

  constructor(config: RuntimeConfig) {
    this.origin = config.url;
    this.serviceKey = config.serviceKey;
    this.anonKey = config.anonKey;
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      token?: string;
      service?: boolean;
      prefer?: string;
    } = {},
  ): Promise<T> {
    const service = options.service !== false;
    const key = service ? this.serviceKey : this.anonKey;
    const headers = new Headers({
      apikey: key,
      Authorization: "Bearer " + (options.token ?? key),
      "Content-Type": "application/json",
    });
    if (options.prefer) headers.set("Prefer", options.prefer);

    let response: Response;
    try {
      response = await fetch(this.origin + path, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new Error("Supabase network request failed for " + path.split("?")[0] + ".");
    }
    if (!response.ok) {
      throw new Error(
        "Supabase request failed with HTTP " + response.status +
          " for " + path.split("?")[0] + ". Response body and credentials were not logged.",
      );
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async listAuthUsers(): Promise<AuthUser[]> {
    const users: AuthUser[] = [];
    for (let page = 1; page <= 100; page += 1) {
      const result = await this.request<{ users?: AuthUser[] }>(
        "/auth/v1/admin/users?page=" + page + "&per_page=1000",
      );
      const batch = result.users ?? [];
      users.push(...batch);
      if (batch.length < 1000) return users;
    }
    throw new Error("Auth user pagination exceeded 100 pages.");
  }

  async createFixtureUser(identity: {
    email: string;
    fullName: string;
    phone: string;
    language: string;
  }): Promise<AuthUser> {
    return await this.request<AuthUser>("/auth/v1/admin/users", {
      method: "POST",
      body: {
        email: identity.email,
        password: randomFixturePassword(),
        email_confirm: true,
        user_metadata: { full_name: identity.fullName, phone: identity.phone },
        app_metadata: { predrive_demo_seed: SEED_MARKER },
      },
    });
  }

  async signInAdmin(email: string, password: string): Promise<string> {
    const result = await this.request<{ access_token: string; user: AuthUser }>(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        service: false,
        body: { email, password },
      },
    );
    if (!result.access_token || result.user.email?.toLowerCase() !== email) {
      throw new Error("School administrator sign-in did not return the expected identity.");
    }
    return result.access_token;
  }

  async rows<T>(
    table: string,
    query: Record<string, string>,
    select = "*",
  ): Promise<T[]> {
    const params = new URLSearchParams({ select, ...query });
    return await this.request<T[]>("/rest/v1/" + table + "?" + params.toString());
  }

  async patchProfile(userId: string, identity: {
    email: string;
    fullName: string;
    phone: string;
    language: string;
  }): Promise<void> {
    const result = await this.request<Array<{ id: string }>>(
      "/rest/v1/profiles?id=eq." + encodeURIComponent(userId) + "&select=id",
      {
        method: "PATCH",
        body: {
          email: identity.email,
          full_name: identity.fullName,
          phone: identity.phone,
          language: identity.language,
        },
        prefer: "return=representation",
      },
    );
    if (result.length !== 1 || result[0].id !== userId) {
      throw new Error("Auth profile trigger did not produce exactly one fixture profile.");
    }
  }

  async rpc<T>(token: string, name: string, args: Record<string, unknown>): Promise<T> {
    return await this.request<T>("/rest/v1/rpc/" + name, {
      method: "POST",
      service: false,
      token,
      body: args,
    });
  }

  async insertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
    await this.request<unknown>("/rest/v1/" + table + "?on_conflict=id", {
      method: "POST",
      body: rows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
}

async function ensureFixtureIdentity(
  api: GreenfieldSeedApi,
  existingUsers: Map<string, AuthUser>,
  identity: {
    role: string;
    email: string;
    fullName: string;
    phone: string;
    language: string;
  },
): Promise<string> {
  let user = existingUsers.get(identity.email);
  if (user && user.app_metadata?.predrive_demo_seed !== SEED_MARKER) {
    throw new Error("A reserved fixture email belongs to an unmarked account; refusing to adopt it.");
  }
  if (!user) {
    user = await api.createFixtureUser(identity);
    if (!user.id || user.email?.toLowerCase() !== identity.email) {
      throw new Error("Supabase Auth did not return the expected fixture account.");
    }
    existingUsers.set(identity.email, user);
  }

  const otherMemberships = await api.rows<{ id: string }>("school_memberships", {
    user_id: "eq." + user.id,
    school_id: "neq." + GREENFIELD_DEMO_SCHOOL_ID,
  });
  if (otherMemberships.length) {
    throw new Error("A fixture identity is already linked to another school.");
  }

  await api.patchProfile(user.id, identity);

  const memberships = await api.rows<Membership>("school_memberships", {
    school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
    user_id: "eq." + user.id,
  });
  if (memberships.length > 1 || (memberships.length === 1 &&
    (memberships[0].role !== identity.role || memberships[0].active !== true))) {
    throw new Error("Existing fixture membership conflicts with its canonical role.");
  }
  if (!memberships.length) {
    await api.request("/rest/v1/school_memberships?on_conflict=school_id,user_id", {
      method: "POST",
      body: { school_id: GREENFIELD_DEMO_SCHOOL_ID, user_id: user.id, role: identity.role, active: true },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  if (["supervisor", "driver", "teacher"].includes(identity.role)) {
    const staffRows = await api.rows<Staff>("staff_members", {
      school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
      user_id: "eq." + user.id,
    });
    if (staffRows.length > 1 || (staffRows.length === 1 &&
      (staffRows[0].role !== identity.role || staffRows[0].full_name !== identity.fullName ||
        staffRows[0].phone !== identity.phone || !staffRows[0].active))) {
      throw new Error("Existing staff fixture conflicts with its canonical identity.");
    }
    if (!staffRows.length) {
      await api.request("/rest/v1/staff_members?on_conflict=school_id,user_id", {
        method: "POST",
        body: {
          school_id: GREENFIELD_DEMO_SCHOOL_ID,
          user_id: user.id,
          role: identity.role,
          full_name: identity.fullName,
          phone: identity.phone,
          active: true,
        },
        prefer: "resolution=merge-duplicates,return=minimal",
      });
    }
  }
  return user.id;
}

async function ensureDemoFoundation(api: GreenfieldSeedApi): Promise<void> {
  const schools = await api.rows<{ id: string; is_demo: boolean; status: string }>("schools", {
    id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
  });
  if (schools.length !== 1 || schools[0].is_demo !== true || schools[0].status !== "active") {
    throw new Error("Apply and verify supabase/seed.sql before running the Greenfield operational seed.");
  }
}

async function ensureChild(
  api: GreenfieldSeedApi,
  adminToken: string,
  fixture: typeof GREENFIELD_CHILDREN[number],
): Promise<{ id: string; created: boolean }> {
  const matches = await api.rows<ChildRow>("children", {
    school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
    class_group_id: "eq." + fixture.classGroupId,
    first_name: "eq." + fixture.firstName,
    last_name: "eq." + fixture.lastName,
    date_of_birth: "eq." + fixture.dateOfBirth,
  });
  if (matches.length > 1) throw new Error("Duplicate child identity tuples exist in the Greenfield school.");
  if (matches.length === 1) return { id: matches[0].id, created: false };

  const id = await api.rpc<string>(adminToken, "create_child", {
    p_school_id: GREENFIELD_DEMO_SCHOOL_ID,
    p_first_name: fixture.firstName,
    p_last_name: fixture.lastName,
    p_date_of_birth: fixture.dateOfBirth,
    p_class_group_id: fixture.classGroupId,
  });
  return { id, created: true };
}

async function ensureRouteAssignment(
  api: GreenfieldSeedApi,
  adminToken: string,
  childId: string,
  routeId: string,
  routeStopId: string,
): Promise<void> {
  const rows = await api.rows<RouteAssignment>("child_route_assignments", {
    school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
    child_id: "eq." + childId,
    active: "eq.true",
  });
  if (rows.length > 1) throw new Error("Multiple active route assignments exist for a demo child.");
  if (rows.length === 1 && rows[0].route_id === routeId && rows[0].route_stop_id === routeStopId) return;
  await api.rpc(adminToken, "assign_child_route_stop", {
    p_school_id: GREENFIELD_DEMO_SCHOOL_ID,
    p_child_id: childId,
    p_route_id: routeId,
    p_route_stop_id: routeStopId,
  });
}

async function ensureGuardianLink(
  api: GreenfieldSeedApi,
  adminToken: string,
  guardianId: string,
  childId: string,
): Promise<void> {
  const rows = await api.rows<{ id: string; active: boolean; relationship: string; primary_contact: boolean }>(
    "guardian_children",
    {
      school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
      guardian_user_id: "eq." + guardianId,
      child_id: "eq." + childId,
    },
  );
  if (rows.length > 1) throw new Error("Duplicate guardian-child links exist.");
  if (rows.length === 1 && rows[0].active && rows[0].relationship === "parent" &&
    rows[0].primary_contact === true) return;

  await api.rpc(adminToken, "link_guardian_to_child", {
    p_school_id: GREENFIELD_DEMO_SCHOOL_ID,
    p_guardian_user_id: guardianId,
    p_child_id: childId,
    p_relationship: "parent",
    p_primary_contact: true,
  });
}

async function ensureCollectors(
  api: GreenfieldSeedApi,
  adminToken: string,
  childId: string,
  childIndex: number,
  childPins: readonly string[],
): Promise<number> {
  if (childPins.length !== GREENFIELD_COLLECTORS_PER_CHILD ||
    childPins.some((pin) => !validateCollectorPin(pin))) {
    throw new Error("Canonical collector PIN set is incomplete.");
  }
  const existing = await api.rows<CollectorRow>(
    "approved_collectors",
    {
      school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
      child_id: "eq." + childId,
    },
    "id,child_id,full_name,phone,active",
  );
  let created = 0;
  for (let sequence = 0; sequence < GREENFIELD_COLLECTORS_PER_CHILD; sequence += 1) {
    const suffix = String(childIndex * 2 + sequence + 1).padStart(6, "0");
    const phone = "+263772" + suffix;
    const collectorIndex = childIndex * 2 + sequence;
    const fullName =
      COLLECTOR_FIRST_NAMES[collectorIndex % COLLECTOR_FIRST_NAMES.length] + " " +
      COLLECTOR_LAST_NAMES[Math.floor(collectorIndex / COLLECTOR_FIRST_NAMES.length)];
    const current = existing.find((row) => row.phone === phone);
    if (current) {
      if (current.full_name !== fullName || !current.active) {
        throw new Error("An existing collector conflicts with the canonical demo fixture.");
      }
      continue;
    }
    await api.rpc(adminToken, "create_approved_collector", {
      p_school_id: GREENFIELD_DEMO_SCHOOL_ID,
      p_child_id: childId,
      p_full_name: fullName,
      p_relationship: sequence === 0 ? "relative" : "authorised_caregiver",
      p_phone: phone,
      p_pin: childPins[sequence],
    });
    created += 1;
  }
  return created;
}

async function ensureRouteSchedules(
  api: GreenfieldSeedApi,
  adminToken: string,
  staffIds: {
    supervisorA: string;
    supervisorB: string;
    supervisorC: string;
    driverA: string;
    driverB: string;
    driverC: string;
  },
): Promise<void> {
  const routes = [
    { routeId: "10000000-0000-4000-8000-000000000301", driver: staffIds.driverA, supervisor: staffIds.supervisorA },
    { routeId: "10000000-0000-4000-8000-000000000302", driver: staffIds.driverB, supervisor: staffIds.supervisorB },
    { routeId: "10000000-0000-4000-8000-000000000303", driver: staffIds.driverC, supervisor: staffIds.supervisorC },
  ];
  const schedules = routes.flatMap((route, index) => [
    {
      id: "10000000-0000-4000-8000-00000000070" + (index * 2 + 1),
      school_id: GREENFIELD_DEMO_SCHOOL_ID,
      route_id: route.routeId,
      direction: "to_school",
      departure_time: "07:00:00",
      days_of_week: [1, 2, 3, 4, 5],
      effective_from: "2026-01-01",
      active: true,
    },
    {
      id: "10000000-0000-4000-8000-00000000070" + (index * 2 + 2),
      school_id: GREENFIELD_DEMO_SCHOOL_ID,
      route_id: route.routeId,
      direction: "from_school",
      departure_time: "15:00:00",
      days_of_week: [1, 2, 3, 4, 5],
      effective_from: "2026-01-01",
      active: true,
    },
  ]);
  const scheduleIds = schedules.map((row) => row.id);
  const existingSchedules = await api.rows<{
    id: string;
    school_id: string;
    route_id: string;
    direction: string;
  }>("route_schedules", { id: "in.(" + scheduleIds.join(",") + ")" });
  for (const existing of existingSchedules) {
    const expected = schedules.find((row) => row.id === existing.id);
    if (
      !expected ||
      existing.school_id !== GREENFIELD_DEMO_SCHOOL_ID ||
      existing.route_id !== expected.route_id ||
      existing.direction !== expected.direction
    ) {
      throw new Error("A reserved route-schedule ID is already owned by a conflicting record.");
    }
  }
  await api.insertRows("route_schedules", schedules);
  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    for (let direction = 0; direction < 2; direction += 1) {
      const scheduleId = schedules[index * 2 + direction].id;
      await api.rpc(adminToken, "assign_route_schedule_staff", {
        p_school_id: GREENFIELD_DEMO_SCHOOL_ID,
        p_schedule_id: scheduleId,
        p_driver_id: route.driver,
        p_supervisor_id: route.supervisor,
      });
    }
  }
}

async function main(): Promise<void> {
  const config: RuntimeConfig = {
    url: projectOrigin(required("SUPABASE_URL")),
    serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: required("SUPABASE_ANON_KEY"),
    adminPassword: required("PREDRIVE_DEMO_ADMIN_PASSWORD"),
    collectorPinSecret: required("PREDRIVE_DEMO_COLLECTOR_PIN_SECRET"),
  };
  if (!validateCollectorPinSecret(config.collectorPinSecret)) {
    throw new Error("PREDRIVE_DEMO_COLLECTOR_PIN_SECRET must contain at least 32 characters.");
  }

  const api = new GreenfieldSeedApi(config);
  const collectorPins = await buildDemoCollectorPins(config.collectorPinSecret);
  await ensureDemoFoundation(api);
  const adminToken = await api.signInAdmin(ADMIN_EMAIL, config.adminPassword);
  const adminProfiles = await api.rows<Profile>("profiles", { email: "eq." + ADMIN_EMAIL });
  if (adminProfiles.length !== 1) {
    throw new Error("Primary school administrator profile is missing or duplicated.");
  }
  const adminMemberships = await api.rows<Membership>("school_memberships", {
    school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
    user_id: "eq." + adminProfiles[0].id,
  });
  if (adminMemberships.length !== 1 || adminMemberships[0].role !== "school_admin" || !adminMemberships[0].active) {
    throw new Error("Primary account is not an active Greenfield school administrator.");
  }
  const chipoProfiles = await api.rows<Profile>("profiles", { email: "eq." + CHIPO_EMAIL });
  if (chipoProfiles.length !== 1) {
    throw new Error("Primary Chipo guardian profile is missing or duplicated.");
  }
  const chipoId = chipoProfiles[0].id;
  const chipoMemberships = await api.rows<Membership>("school_memberships", {
    school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
    user_id: "eq." + chipoId,
  });
  if (chipoMemberships.length !== 1 || chipoMemberships[0].role !== "guardian" || !chipoMemberships[0].active) {
    throw new Error("Chipo's primary guardian membership is missing or inactive.");
  }

  const primaryStaffFixtures = [
    { email: "supervisor.route-a@greenfield.predrive-demo.invalid", role: "supervisor" },
    { email: "driver.route-a@greenfield.predrive-demo.invalid", role: "driver" },
    { email: "teacher.sunbeams@greenfield.predrive-demo.invalid", role: "teacher" },
  ];
  for (const primary of primaryStaffFixtures) {
    const profiles = await api.rows<Profile>("profiles", { email: "eq." + primary.email });
    if (profiles.length !== 1) throw new Error("Primary staff profile is missing or duplicated: " + primary.email);
    const memberships = await api.rows<Membership>("school_memberships", {
      school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
      user_id: "eq." + profiles[0].id,
    });
    if (memberships.length !== 1 || memberships[0].role !== primary.role || !memberships[0].active) {
      throw new Error("Primary staff membership is missing or has the wrong role: " + primary.email);
    }
    const staff = await api.rows<Staff>("staff_members", {
      school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
      user_id: "eq." + profiles[0].id,
    });
    if (staff.length !== 1 || staff[0].role !== primary.role || !staff[0].active) {
      throw new Error("Primary staff record is missing or inactive: " + primary.email);
    }
  }

  const users = await api.listAuthUsers();
  const userByEmail = new Map(
    users.filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user]),
  );
  const supportingIdentities = [...GREENFIELD_GUARDIAN_FIXTURES, ...GREENFIELD_STAFF_FIXTURES];
  for (const identity of supportingIdentities) {
    const existing = userByEmail.get(identity.email);
    if (existing && existing.app_metadata?.predrive_demo_seed !== SEED_MARKER) {
      throw new Error("A reserved fixture email belongs to an unmarked account; refusing all fixture creation.");
    }
    if (existing) {
      const memberships = await api.rows<{ id: string }>("school_memberships", {
        user_id: "eq." + existing.id,
        school_id: "neq." + GREENFIELD_DEMO_SCHOOL_ID,
      });
      if (memberships.length) {
        throw new Error("A reserved fixture identity is linked to another school; refusing all fixture creation.");
      }
    }
  }

  const fixtureIds = new Map<string, string>();
  for (const identity of supportingIdentities) {
    const id = await ensureFixtureIdentity(api, userByEmail, identity);
    fixtureIds.set(identity.email, id);
  }

  const primaryStaffEmails = [
    "supervisor.route-a@greenfield.predrive-demo.invalid",
    "driver.route-a@greenfield.predrive-demo.invalid",
  ];
  const staffEmailByRoute = [
    {
      supervisor: primaryStaffEmails[0],
      driver: primaryStaffEmails[1],
    },
    {
      supervisor: "supervisor.route-b@greenfield.predrive-demo.invalid",
      driver: "driver.route-b@greenfield.predrive-demo.invalid",
    },
    {
      supervisor: "supervisor.route-c@greenfield.predrive-demo.invalid",
      driver: "driver.route-c@greenfield.predrive-demo.invalid",
    },
  ];

  const staffIds: string[] = [];
  for (const route of staffEmailByRoute) {
    for (const email of [route.supervisor, route.driver]) {
      let userId: string | undefined;
      if (email.endsWith("route-a@greenfield.predrive-demo.invalid")) {
        const primaryProfiles = await api.rows<Profile>("profiles", { email: "eq." + email });
        if (primaryProfiles.length !== 1) {
          throw new Error("A primary route staff profile is missing or duplicated: " + email);
        }
        userId = primaryProfiles[0].id;
      } else {
        userId = fixtureIds.get(email);
      }
      if (!userId) throw new Error("A canonical route staff profile is missing: " + email);
      const staff = await api.rows<Staff>("staff_members", {
        school_id: "eq." + GREENFIELD_DEMO_SCHOOL_ID,
        user_id: "eq." + userId,
      });
      if (staff.length !== 1 || !staff[0].active) throw new Error("A route staff record is missing or inactive.");
      staffIds.push(staff[0].id);
    }
  }

  let childrenCreated = 0;
  let collectorsCreated = 0;
  for (let index = 0; index < GREENFIELD_CHILDREN.length; index += 1) {
    const fixture = GREENFIELD_CHILDREN[index];
    const child = await ensureChild(api, adminToken, fixture);
    const childId = child.id;
    if (child.created) childrenCreated += 1;
    const guardianEmail = GREENFIELD_GUARDIAN_EMAIL_BY_CHILD_INDEX[index];
    const guardianId = guardianEmail === CHIPO_EMAIL
      ? chipoId
      : fixtureIds.get(guardianEmail);
    if (!guardianId) throw new Error("Missing guardian fixture identity for " + guardianEmail);

    await ensureGuardianLink(api, adminToken, guardianId, childId);
    await ensureRouteAssignment(api, adminToken, childId, fixture.routeId, fixture.routeStopId);
    collectorsCreated += await ensureCollectors(api, adminToken, childId, index, collectorPins[index]);
  }

  const staffAssignment = {
    supervisorA: staffIds[0],
    driverA: staffIds[1],
    supervisorB: staffIds[2],
    driverB: staffIds[3],
    supervisorC: staffIds[4],
    driverC: staffIds[5],
  };
  await ensureRouteSchedules(api, adminToken, staffAssignment);

  console.log(JSON.stringify({
    schoolId: GREENFIELD_DEMO_SCHOOL_ID,
    childFixtures: GREENFIELD_CHILDREN.length,
    guardianHouseholds: 32,
    supportingGuardianAccounts: GREENFIELD_GUARDIAN_FIXTURES.length,
    staffCount: 12,
    routeSchedules: 6,
    collectorsPerChild: GREENFIELD_COLLECTORS_PER_CHILD,
    collectorRowsCreatedThisRun: collectorsCreated,
    childRecordsCreatedThisRun: childrenCreated,
    note: "No credentials or PINs were logged. Supporting Auth passwords are random and intentionally not displayed.",
  }));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Greenfield operational seed failed.");
    Deno.exit(1);
  }
}
