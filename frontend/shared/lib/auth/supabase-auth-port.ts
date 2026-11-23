import type {
  AuthIdentity,
  AuthMembership,
  AuthPort,
} from "./session-service";
import { AuthPortError } from "./session-service";
import type {
  LanguageCode,
  School,
  SchoolMembership,
  UserProfile,
  UserRole,
} from "../../types";

type SupabaseErrorLike = {
  code?: string;
  message: string;
  status?: number;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseErrorLike | null;
};

type AuthUserRecord = {
  id: string;
  email?: string | null;
};

type AuthSessionRecord = {
  user: AuthUserRecord;
  expires_at?: number;
  expires_in?: number;
};

type QueryBuilder<T> = PromiseLike<SupabaseResult<T>> & {
  select(columns: string): QueryBuilder<T>;
  eq(column: string, value: string | boolean): QueryBuilder<T>;
  in(column: string, values: string[]): QueryBuilder<T>;
  maybeSingle(): PromiseLike<SupabaseResult<T | null>>;
};

export interface SupabaseAuthClient {
  auth: {
    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<SupabaseResult<{
      user: AuthUserRecord | null;
      session: AuthSessionRecord | null;
    }>>;
    getUser(): Promise<SupabaseResult<{ user: AuthUserRecord | null }>>;
    getSession(): Promise<SupabaseResult<{ session: AuthSessionRecord | null }>>;
    signOut(): Promise<{ error: SupabaseErrorLike | null }>;
    resetPasswordForEmail(
      email: string,
      options?: { redirectTo?: string },
    ): Promise<{ error: SupabaseErrorLike | null }>;
  };
  rpc(
    functionName: string,
    args?: Record<string, unknown>,
  ): Promise<SupabaseResult<unknown>>;
  from(table: string): {
    select(columns: string): QueryBuilder<unknown>;
  };
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  language: string;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SchoolRow = {
  id: string;
  name: string;
  status: string;
  address: string;
  timezone: string;
  indicative_zig_per_usd: number;
  created_at: string;
  updated_at: string;
};

const USER_ROLES: readonly UserRole[] = [
  "school_admin",
  "guardian",
  "supervisor",
  "driver",
  "teacher",
];

const LANGUAGES: readonly LanguageCode[] = ["en", "sn", "nd"];

function mapSupabaseError(error: SupabaseErrorLike): AuthPortError {
  if (error.status === 429) {
    return new AuthPortError("RATE_LIMITED", "Too many requests. Please try again shortly.", true);
  }

  if (error.status === undefined && /network|fetch|timeout|connection/i.test(error.message)) {
    return new AuthPortError("NETWORK", "Check your connection and try again.", true);
  }

  if (error.status === 400 || error.status === 401 || error.status === 403) {
    return new AuthPortError("UNAUTHENTICATED", "Authentication could not be completed.");
  }

  if (error.status !== undefined && error.status >= 500) {
    return new AuthPortError("UNAVAILABLE", "The authentication service is temporarily unavailable.", true);
  }

  return new AuthPortError("UNKNOWN", "The authentication request could not be completed.");
}

function assertNoError(error: SupabaseErrorLike | null): void {
  if (error) throw mapSupabaseError(error);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuthPortError("UNKNOWN", `The account record is missing ${field}.`);
  }
  return value;
}

function mapProfile(row: ProfileRow, authEmail: string): UserProfile {
  const language = LANGUAGES.includes(row.language as LanguageCode)
    ? (row.language as LanguageCode)
    : "en";

  return {
    id: requiredString(row.id, "profile ID"),
    authUserId: row.id,
    fullName: requiredString(row.full_name, "full name"),
    email: row.email?.trim() || authEmail,
    phone: row.phone ?? undefined,
    language,
    createdAt: requiredString(row.created_at, "profile creation time"),
    updatedAt: requiredString(row.updated_at, "profile update time"),
  };
}

function mapMembership(row: MembershipRow): SchoolMembership {
  if (!USER_ROLES.includes(row.role as UserRole)) {
    throw new AuthPortError("UNKNOWN", "The account has an unsupported school role.");
  }

  return {
    id: requiredString(row.id, "membership ID"),
    schoolId: requiredString(row.school_id, "membership school ID"),
    userId: requiredString(row.user_id, "membership user ID"),
    role: row.role as UserRole,
    active: row.active === true,
    createdAt: requiredString(row.created_at, "membership creation time"),
    updatedAt: requiredString(row.updated_at, "membership update time"),
  };
}

function mapSchool(row: SchoolRow): School {
  if (row.timezone !== "Africa/Harare") {
    throw new AuthPortError("UNKNOWN", "The school timezone is not configured for Zimbabwe.");
  }

  if (!["pending", "active", "suspended"].includes(row.status)) {
    throw new AuthPortError("UNKNOWN", "The school has an unsupported status.");
  }

  return {
    id: requiredString(row.id, "school ID"),
    name: requiredString(row.name, "school name"),
    status: row.status as School["status"],
    address: requiredString(row.address, "school address"),
    timezone: "Africa/Harare",
    indicativeZigPerUsd: Number(row.indicative_zig_per_usd),
    createdAt: requiredString(row.created_at, "school creation time"),
    updatedAt: requiredString(row.updated_at, "school update time"),
  };
}

/**
 * Supabase-backed implementation of the shared AuthPort.
 *
 * The client must be created with a publishable/anon key. This adapter never
 * accepts or stores a service-role credential. All school membership and
 * school reads are made under the signed-in user's JWT and remain subject to
 * the database's RLS policies.
 */
export class SupabaseAuthPort implements AuthPort {
  private activeSchoolId: string | null = null;

  constructor(
    private readonly client: SupabaseAuthClient,
    private readonly passwordResetRedirectTo?: string,
    private readonly now: () => number = Date.now,
  ) {}

  setActiveSchool(schoolId: string): void {
    this.activeSchoolId = schoolId;
  }

  getActiveSchoolId(): string | null {
    return this.activeSchoolId;
  }

  async signIn(input: { email: string; password: string }): Promise<AuthIdentity> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    assertNoError(error);

    if (!data.user || !data.session || data.user.id !== data.session.user.id) {
      throw new AuthPortError("UNAUTHENTICATED", "The sign-in response did not contain a valid session.");
    }

    this.activeSchoolId = null;

    // Accept only after Supabase has authenticated this exact email identity.
    // The RPC derives user ID and email from auth.uid() and the verified profile.
    const { data: acceptedSchoolId, error: invitationError } = await this.client
      .rpc("accept_school_invitation");

    if (
      invitationError &&
      !(
        invitationError.code === "P0002" &&
        invitationError.message === "INVITATION_NOT_FOUND"
      )
    ) {
      assertNoError(invitationError);
    }

    if (typeof acceptedSchoolId === "string") {
      this.activeSchoolId = acceptedSchoolId;
    }

    return this.identityFromSession(data.session);
  }

  async getCurrentIdentity(): Promise<AuthIdentity | null> {
    const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] =
      await Promise.all([this.client.auth.getUser(), this.client.auth.getSession()]);

    assertNoError(userError);
    assertNoError(sessionError);

    const user = userData.user;
    const session = sessionData.session;

    if (!user || !session) return null;
    if (user.id !== session.user.id) {
      throw new AuthPortError("UNAUTHENTICATED", "The active session identity could not be verified.");
    }

    return this.identityFromSession(session);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    assertNoError(error);
    this.activeSchoolId = null;
  }

  async requestPasswordReset(input: { email: string }): Promise<void> {
    const options = this.passwordResetRedirectTo
      ? { redirectTo: this.passwordResetRedirectTo }
      : undefined;
    const { error } = await this.client.auth.resetPasswordForEmail(
      input.email.trim().toLowerCase(),
      options,
    );
    assertNoError(error);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("id,full_name,email,phone,language,created_at,updated_at")
      .eq("id", userId)
      .maybeSingle();

    assertNoError(error);
    if (!data) return null;

    const row = data as ProfileRow;
    return mapProfile(row, row.email ?? "");
  }

  async listMemberships(userId: string): Promise<AuthMembership[]> {
    const { data, error } = await this.client
      .from("school_memberships")
      .select("id,school_id,user_id,role,active,created_at,updated_at")
      .eq("user_id", userId);

    assertNoError(error);

    const membershipRows = (data ?? []) as MembershipRow[];
    if (membershipRows.length === 0) return [];

    const schoolIds = [...new Set(membershipRows.map((row) => row.school_id))];
    const { data: schoolData, error: schoolError } = await this.client
      .from("schools")
      .select("id,name,status,address,timezone,indicative_zig_per_usd,created_at,updated_at")
      .in("id", schoolIds);

    assertNoError(schoolError);

    const schools = new Map(
      ((schoolData ?? []) as SchoolRow[]).map((row) => [row.id, mapSchool(row)]),
    );

    return membershipRows.map((row) => ({
      membership: mapMembership(row),
      school: schools.get(row.school_id) ?? null,
    }));
  }

  private identityFromSession(session: AuthSessionRecord): AuthIdentity {
    const expirySeconds =
      session.expires_at ??
      (session.expires_in !== undefined
        ? Math.floor(this.now() / 1000) + session.expires_in
        : undefined);

    if (expirySeconds === undefined || !Number.isFinite(expirySeconds)) {
      throw new AuthPortError("UNAUTHENTICATED", "The session expiry could not be verified.");
    }

    return {
      userId: requiredString(session.user.id, "authenticated user ID"),
      email: session.user.email?.trim() ?? "",
      expiresAt: new Date(expirySeconds * 1000).toISOString(),
    };
  }
}
