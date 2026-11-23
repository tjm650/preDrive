type DemoRole = "school_admin" | "guardian" | "supervisor" | "driver" | "teacher";
type DemoLanguage = "en" | "sn" | "nd";

type DemoUser = {
  role: DemoRole;
  email: string;
  fullName: string;
  phone: string;
  language: DemoLanguage;
  passwordEnv: string;
};

type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

type MembershipRow = {
  id: string;
  role: DemoRole;
  active: boolean;
};

type StaffRow = {
  id: string;
  role: DemoRole;
  full_name: string;
  phone: string;
  active: boolean;
};

const DEMO_SEED_MARKER = "greenfield-demo-v1";
export const DEMO_SCHOOL_ID = "10000000-0000-4000-8000-000000000001";

export const DEMO_USERS: readonly DemoUser[] = [
  {
    role: "school_admin",
    email: "admin@greenfield.predrive-demo.invalid",
    fullName: "Mrs. Patience Mhlanga",
    phone: "+263771000101",
    language: "en",
    passwordEnv: "PREDRIVE_DEMO_ADMIN_PASSWORD",
  },
  {
    role: "guardian",
    email: "chipo.moyo@greenfield.predrive-demo.invalid",
    fullName: "Mrs. Chipo Moyo",
    phone: "+263771000102",
    language: "sn",
    passwordEnv: "PREDRIVE_DEMO_GUARDIAN_PASSWORD",
  },
  {
    role: "supervisor",
    email: "supervisor.route-a@greenfield.predrive-demo.invalid",
    fullName: "Tawanda Moyo",
    phone: "+263771000103",
    language: "en",
    passwordEnv: "PREDRIVE_DEMO_SUPERVISOR_PASSWORD",
  },
  {
    role: "driver",
    email: "driver.route-a@greenfield.predrive-demo.invalid",
    fullName: "Farai Dube",
    phone: "+263771000104",
    language: "en",
    passwordEnv: "PREDRIVE_DEMO_DRIVER_PASSWORD",
  },
  {
    role: "teacher",
    email: "teacher.sunbeams@greenfield.predrive-demo.invalid",
    fullName: "Rudo Ndlovu",
    phone: "+263771000105",
    language: "nd",
    passwordEnv: "PREDRIVE_DEMO_TEACHER_PASSWORD",
  },
] as const;

export function isStrongDemoPassword(value: string | undefined): value is string {
  return typeof value === "string" &&
    value.length >= 16 &&
    value.length <= 128 &&
    value.trim().length >= 16 &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function projectUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error("SUPABASE_URL must use HTTPS outside local development.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("SUPABASE_URL must not contain credentials, query parameters or a fragment.");
  }
  return url.origin;
}

class SupabaseAdminApi {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(url: string, serviceKey: string) {
    this.baseUrl = projectUrl(url);
    this.serviceKey = serviceKey;
  }

  private headers(extra: Record<string, string> = {}): Headers {
    return new Headers({
      apikey: this.serviceKey,
      Authorization: "Bearer " + this.serviceKey,
      "Content-Type": "application/json",
      ...extra,
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        ...init,
        headers: this.headers(
          init.headers instanceof Headers
            ? Object.fromEntries(init.headers.entries())
            : (init.headers as Record<string, string> | undefined) ?? {},
        ),
      });
    } catch {
      throw new Error("Supabase request failed. Check network access and the project URL.");
    }

    if (!response.ok) {
      throw new Error(
        "Supabase request failed with HTTP " + response.status +
          " for " + path.split("?")[0] + ". No response body or credentials were logged.",
      );
    }

    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async listUsers(): Promise<AuthUser[]> {
    const allUsers: AuthUser[] = [];
    const pageSize = 1000;
    for (let page = 1; page <= 100; page += 1) {
      const result = await this.request<{ users?: AuthUser[] }>(
        "/auth/v1/admin/users?page=" + page + "&per_page=" + pageSize,
      );
      const users = result.users ?? [];
      allUsers.push(...users);
      if (users.length < pageSize) return allUsers;
    }
    throw new Error("Auth user pagination exceeded the safety limit of 100 pages.");
  }

  async createUser(user: DemoUser, password: string): Promise<AuthUser> {
    return await this.request<AuthUser>("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          phone: user.phone,
        },
        app_metadata: {
          predrive_demo_seed: DEMO_SEED_MARKER,
        },
      }),
    });
  }

  async getRows<T>(table: string, query: URLSearchParams): Promise<T[]> {
    return await this.request<T[]>(
      "/rest/v1/" + table + "?" + query.toString(),
    );
  }

  async insertRows(
    table: string,
    rows: Record<string, unknown>,
    conflictColumns: string,
  ): Promise<void> {
    await this.request<unknown>(
      "/rest/v1/" + table + "?on_conflict=" + encodeURIComponent(conflictColumns),
      {
        method: "POST",
        headers: new Headers({
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(rows),
      },
    );
  }

  async updateProfile(user: DemoUser, userId: string): Promise<void> {
    const query = new URLSearchParams({
      id: "eq." + userId,
      select: "id",
    });
    const rows = await this.request<Array<{ id: string }>>(
      "/rest/v1/profiles?" + query.toString(),
      {
        method: "PATCH",
        headers: new Headers({ Prefer: "return=representation" }),
        body: JSON.stringify({
          full_name: user.fullName,
          email: user.email,
          phone: user.phone,
          language: user.language,
        }),
      },
    );
    if (rows.length !== 1 || rows[0].id !== userId) {
      throw new Error("The Auth profile trigger did not produce exactly one matching profile.");
    }
  }

  async assertDemoSchool(): Promise<void> {
    const rows = await this.getRows<{
      id: string;
      is_demo: boolean;
      status: string;
    }>(
      "schools",
      new URLSearchParams({
        select: "id,is_demo,status",
        id: "eq." + DEMO_SCHOOL_ID,
      }),
    );
    if (
      rows.length !== 1 ||
      rows[0].is_demo !== true ||
      rows[0].status !== "active"
    ) {
      throw new Error(
        "Greenfield must exist, be active and have is_demo=true before Auth provisioning.",
      );
    }
  }

  async assertNoOtherDemoMembership(userId: string): Promise<void> {
    const rows = await this.getRows<{ id: string }>(
      "school_memberships",
      new URLSearchParams({
        select: "id",
        user_id: "eq." + userId,
        school_id: "neq." + DEMO_SCHOOL_ID,
      }),
    );
    if (rows.length > 0) {
      throw new Error("A reserved demo identity is already linked to another school.");
    }
  }

  async ensureMembership(userId: string, role: DemoRole): Promise<void> {
    const query = new URLSearchParams({
      select: "id,role,active",
      school_id: "eq." + DEMO_SCHOOL_ID,
      user_id: "eq." + userId,
    });
    const existing = await this.getRows<MembershipRow>("school_memberships", query);
    if (existing.length > 1) {
      throw new Error("Duplicate Greenfield memberships detected for a demo identity.");
    }
    if (existing.length === 1) {
      if (existing[0].role !== role || existing[0].active !== true) {
        throw new Error("Existing Greenfield membership conflicts with the canonical demo role.");
      }
      return;
    }

    await this.insertRows(
      "school_memberships",
      { school_id: DEMO_SCHOOL_ID, user_id: userId, role, active: true },
      "school_id,user_id",
    );

    const verified = await this.getRows<MembershipRow>("school_memberships", query);
    if (
      verified.length !== 1 ||
      verified[0].role !== role ||
      verified[0].active !== true
    ) {
      throw new Error("Greenfield membership could not be verified after insertion.");
    }
  }

  async ensureStaff(userId: string, user: DemoUser): Promise<void> {
    if (user.role === "school_admin" || user.role === "guardian") return;

    const query = new URLSearchParams({
      select: "id,role,full_name,phone,active",
      school_id: "eq." + DEMO_SCHOOL_ID,
      user_id: "eq." + userId,
    });
    const existing = await this.getRows<StaffRow>("staff_members", query);
    if (existing.length > 1) {
      throw new Error("Duplicate Greenfield staff records detected for a demo identity.");
    }
    if (existing.length === 1) {
      const row = existing[0];
      if (
        row.role !== user.role ||
        row.full_name !== user.fullName ||
        row.phone !== user.phone ||
        row.active !== true
      ) {
        throw new Error("Existing Greenfield staff record conflicts with the canonical demo identity.");
      }
      return;
    }

    await this.insertRows(
      "staff_members",
      {
        school_id: DEMO_SCHOOL_ID,
        user_id: userId,
        role: user.role,
        full_name: user.fullName,
        phone: user.phone,
        active: true,
      },
      "school_id,user_id",
    );

    const verified = await this.getRows<StaffRow>("staff_members", query);
    if (
      verified.length !== 1 ||
      verified[0].role !== user.role ||
      verified[0].full_name !== user.fullName ||
      verified[0].phone !== user.phone ||
      verified[0].active !== true
    ) {
      throw new Error("Greenfield staff record could not be verified after insertion.");
    }
  }
}

export async function provisionDemoUsers(
  api: SupabaseAdminApi,
  passwords: ReadonlyMap<string, string>,
): Promise<void> {
  await api.assertDemoSchool();
  const users = await api.listUsers();
  const byEmail = new Map(
    users
      .filter((user) => typeof user.email === "string")
      .map((user) => [user.email!.toLowerCase(), user]),
  );

  // Validate every reserved email and every password needed for a new account
  // before the first Auth mutation, avoiding preventable partial provisioning.
  for (const demoUser of DEMO_USERS) {
    const existing = byEmail.get(demoUser.email);
    if (existing) {
      if (existing.app_metadata?.predrive_demo_seed !== DEMO_SEED_MARKER) {
        throw new Error(
          "A reserved demo email is already owned by an account not marked for this seed. Refusing to adopt it.",
        );
      }
      await api.assertNoOtherDemoMembership(existing.id);
    } else if (!isStrongDemoPassword(passwords.get(demoUser.passwordEnv))) {
      throw new Error(
        "A strong password of 16–128 characters is required in " +
          demoUser.passwordEnv + " for a new demo account.",
      );
    }
  }

  for (const demoUser of DEMO_USERS) {
    let authUser = byEmail.get(demoUser.email);
    if (!authUser) {
      const password = passwords.get(demoUser.passwordEnv);
      if (!isStrongDemoPassword(password)) {
        throw new Error("Demo password preflight unexpectedly failed.");
      }
      authUser = await api.createUser(demoUser, password);
      if (!authUser.id || authUser.email?.toLowerCase() !== demoUser.email) {
        throw new Error("Supabase Auth did not return the expected newly-created demo identity.");
      }
      byEmail.set(demoUser.email, authUser);
    }

    await api.assertNoOtherDemoMembership(authUser.id);
    await api.updateProfile(demoUser, authUser.id);
    await api.ensureMembership(authUser.id, demoUser.role);
    await api.ensureStaff(authUser.id, demoUser);
  }
}

async function main(): Promise<void> {
  const url = requiredEnvironment("SUPABASE_URL");
  const serviceKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const passwords = new Map<string, string>();
  for (const user of DEMO_USERS) {
    const value = Deno.env.get(user.passwordEnv);
    if (value !== undefined) passwords.set(user.passwordEnv, value);
  }

  const api = new SupabaseAdminApi(url, serviceKey);
  await provisionDemoUsers(api, passwords);
  console.log("Verified five Greenfield demo Auth identities and their school memberships.");
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provisioning failure.";
    console.error("Demo Auth provisioning failed: " + message);
    Deno.exit(1);
  }
}
