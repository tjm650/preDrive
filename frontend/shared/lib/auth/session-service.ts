import type { AuthSession } from "../api/contract";
import type { ApiError, ApiResult } from "../api/types";
import type { PasswordResetInput, SignInInput } from "../api/inputs";
import type { School, SchoolMembership, UserProfile } from "../../types";

/**
 * Authentication boundary for the shared API layer.
 *
 * A concrete Supabase adapter implements this port. The port deliberately
 * exposes domain records rather than a Supabase SDK type so that shared
 * business rules remain usable by both Expo and Next.js.
 */
export interface AuthIdentity {
  userId: string;
  email: string;
  expiresAt: string;
}

export interface AuthMembership {
  membership: SchoolMembership;
  school: School | null;
}

export interface AuthPort {
  signIn(input: SignInInput): Promise<AuthIdentity>;
  getCurrentIdentity(): Promise<AuthIdentity | null>;
  signOut(): Promise<void>;
  requestPasswordReset(input: PasswordResetInput): Promise<void>;
  getProfile(userId: string): Promise<UserProfile | null>;
  listMemberships(userId: string): Promise<AuthMembership[]>;
  setActiveSchool?(schoolId: string): void | Promise<void>;
  getActiveSchoolId?(): string | null;
}

export type AuthPortErrorCode =
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "NETWORK"
  | "UNAVAILABLE"
  | "UNKNOWN";

export class AuthPortError extends Error {
  readonly code: AuthPortErrorCode;
  readonly retryable: boolean;

  constructor(
    code: AuthPortErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "AuthPortError";
    this.code = code;
    this.retryable = retryable;
  }
}

const errors = {
  unauthenticated: (): ApiError => ({
    code: "UNAUTHENTICATED",
    message: "Your session has expired. Please sign in again.",
    retryable: false,
  }),
  forbidden: (): ApiError => ({
    code: "FORBIDDEN",
    message: "You do not have access to that school.",
    retryable: false,
  }),
  invalidSession: (): ApiError => ({
    code: "UNAUTHENTICATED",
    message: "Your sign-in could not be verified. Please sign in again.",
    retryable: false,
  }),
  unknown: (): ApiError => ({
    code: "UNKNOWN",
    message: "We could not complete that request. Please try again.",
    retryable: false,
  }),
};

function toApiError(error: unknown): ApiError {
  if (!(error instanceof AuthPortError)) return errors.unknown();

  return {
    code: error.code,
    message:
      error.code === "UNAUTHENTICATED"
        ? "Your email or password could not be verified."
        : error.message,
    retryable: error.retryable,
  };
}

function isUsableIdentity(
  identity: AuthIdentity | null,
  now: number,
): identity is AuthIdentity {
  if (!identity || !identity.userId.trim() || !identity.email.trim()) {
    return false;
  }

  const expiry = Date.parse(identity.expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

function isUsableMembership(
  item: AuthMembership,
  userId: string,
): item is AuthMembership & { school: School } {
  return (
    item.membership.userId === userId &&
    item.membership.active &&
    item.school !== null &&
    item.school.id === item.membership.schoolId &&
    item.school.status !== "suspended"
  );
}

export class AuthSessionService {
  constructor(
    private readonly port: AuthPort,
    private readonly now: () => number = Date.now,
  ) {}

  async signIn(input: SignInInput): Promise<ApiResult<AuthSession>> {
    try {
      const identity = await this.port.signIn(input);
      return await this.createSession(identity);
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  async getSession(): Promise<ApiResult<AuthSession | null>> {
    try {
      const identity = await this.port.getCurrentIdentity();

      if (!identity) return { ok: true, data: null };
      if (!isUsableIdentity(identity, this.now())) {
        return { ok: false, error: errors.invalidSession() };
      }

      return await this.createSession(identity);
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  async signOut(): Promise<ApiResult<void>> {
    try {
      await this.port.signOut();
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  async requestPasswordReset(
    input: PasswordResetInput,
  ): Promise<ApiResult<void>> {
    try {
      await this.port.requestPasswordReset(input);
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  async switchSchool(schoolId: string): Promise<ApiResult<AuthSession>> {
    try {
      if (!schoolId.trim()) {
        return {
          ok: false,
          error: {
            code: "VALIDATION",
            message: "Choose a valid school.",
            retryable: false,
            fieldErrors: [{ field: "schoolId", message: "A school is required." }],
          },
        };
      }

      const identity = await this.port.getCurrentIdentity();
      if (!isUsableIdentity(identity, this.now())) {
        return { ok: false, error: errors.unauthenticated() };
      }

      const session = await this.createSession(identity);
      if (!session.ok) return session;

      const selected = session.data.memberships.find(
        (membership) =>
          membership.schoolId === schoolId && membership.active,
      );

      if (!selected) return { ok: false, error: errors.forbidden() };

      const memberships = await this.port.listMemberships(identity.userId);
      const selectedMembership = memberships.find(
        (item) =>
          item.membership.schoolId === schoolId &&
          isUsableMembership(item, identity.userId),
      );

      if (!selectedMembership?.school) {
        return { ok: false, error: errors.forbidden() };
      }

      await this.port.setActiveSchool?.(schoolId);

      return {
        ok: true,
        data: {
          ...session.data,
          activeSchool: selectedMembership.school,
        },
      };
    } catch (error) {
      return { ok: false, error: toApiError(error) };
    }
  }

  private async createSession(
    identity: AuthIdentity,
  ): Promise<ApiResult<AuthSession>> {
    if (!isUsableIdentity(identity, this.now())) {
      return { ok: false, error: errors.invalidSession() };
    }

    const [profile, membershipRows] = await Promise.all([
      this.port.getProfile(identity.userId),
      this.port.listMemberships(identity.userId),
    ]);

    if (!profile || profile.authUserId !== identity.userId) {
      return { ok: false, error: errors.invalidSession() };
    }

    const memberships = membershipRows
      .filter((item) => isUsableMembership(item, identity.userId))
      .map((item) => item.membership);

    const preferredSchoolId = this.port.getActiveSchoolId?.() ?? null;
    const activeSchoolId = memberships.some((item) => item.schoolId === preferredSchoolId)
      ? preferredSchoolId
      : memberships[0]?.schoolId ?? null;
    const activeSchool =
      membershipRows.find(
        (item) =>
          item.membership.schoolId === activeSchoolId &&
          isUsableMembership(item, identity.userId),
      )?.school ?? null;

    // Restore the default membership into the tenant-scoped data adapter
    // after a fresh app launch, not only after an explicit school switch.
    if (activeSchoolId && activeSchoolId !== preferredSchoolId) {
      await this.port.setActiveSchool?.(activeSchoolId);
    }

    return {
      ok: true,
      data: {
        user: profile,
        memberships,
        activeSchool,
        expiresAt: identity.expiresAt,
      },
    };
  }
}
