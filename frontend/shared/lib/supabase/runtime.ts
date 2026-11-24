import type { AuthSession } from "../api/contract";
import type { ApiResult } from "../api/types";
import type { PasswordResetInput, SignInInput } from "../api/inputs";
import { AuthSessionService } from "../auth/session-service";
import { SupabaseAuthPort, type SupabaseAuthClient } from "../auth/supabase-auth-port";

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
  passwordResetRedirectTo?: string;
}

export interface SupabaseRuntime {
  auth: {
    signIn(input: SignInInput): Promise<ApiResult<AuthSession>>;
    signOut(): Promise<ApiResult<void>>;
    getSession(): Promise<ApiResult<AuthSession | null>>;
    requestPasswordReset(input: PasswordResetInput): Promise<ApiResult<void>>;
    switchSchool(schoolId: string): Promise<ApiResult<AuthSession>>;
  };
  setActiveSchool(schoolId: string): void;
  getActiveSchoolId(): string | null;
}

function validatePublicConfig(config: SupabasePublicConfig): void {
  let url: URL;

  try {
    url = new URL(config.url);
  } catch {
    throw new Error("A valid Supabase project URL is required.");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Supabase must use HTTPS outside local development.");
  }

  if (!url.hostname.endsWith(".supabase.co") && url.hostname !== "localhost") {
    throw new Error("The configured Supabase URL is not a supported project host.");
  }

  if (!config.publishableKey.trim()) {
    throw new Error("A Supabase publishable or anon key is required.");
  }

  if (/service[_-]?role/i.test(config.publishableKey)) {
    throw new Error("A service-role credential must never be used in a client runtime.");
  }
}

/**
 * Compose the existing shared session service with an SDK client supplied by
 * the consuming application. The SDK dependency stays at the app boundary;
 * this package never reads process.env or stores privileged credentials.
 */
export function createSupabaseRuntime(input: {
  config: SupabasePublicConfig;
  client: SupabaseAuthClient;
  now?: () => number;
}): SupabaseRuntime {
  validatePublicConfig(input.config);

  const port = new SupabaseAuthPort(
    input.client,
    input.config.passwordResetRedirectTo,
    input.now,
  );
  const sessions = new AuthSessionService(port, input.now);

  return {
    auth: {
      signIn: (credentials) => sessions.signIn(credentials),
      signOut: () => sessions.signOut(),
      getSession: () => sessions.getSession(),
      requestPasswordReset: (request) => sessions.requestPasswordReset(request),
      switchSchool: (schoolId) => sessions.switchSchool(schoolId),
    },
    setActiveSchool: (schoolId) => port.setActiveSchool(schoolId),
    getActiveSchoolId: () => port.getActiveSchoolId(),
  };
}
