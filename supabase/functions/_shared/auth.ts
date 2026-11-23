import type { User } from "npm:@supabase/supabase-js@2.119.2";
import { HttpError } from "./errors.ts";
import {
  createServiceClient,
  type ServiceClient,
} from "./supabase.ts";

export type AppRole =
  | "school_admin"
  | "guardian"
  | "supervisor"
  | "driver"
  | "teacher";

export interface AuthenticatedRequest {
  user: User;
  accessToken: string;
  client: ServiceClient;
}

export interface SchoolAuthorization {
  userId: string;
  schoolId: string;
  role: AppRole;
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new HttpError(
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  }
  return match[1].trim();
}

export async function requireUser(
  request: Request,
  client: ServiceClient = createServiceClient(),
): Promise<AuthenticatedRequest> {
  const accessToken = bearerToken(request);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new HttpError(
      "UNAUTHENTICATED",
      "Your session is invalid or has expired. Sign in again.",
      401,
    );
  }

  return {
    user: data.user,
    accessToken,
    client,
  };
}

export async function requireSchoolRole(
  request: Request,
  schoolId: string,
  allowedRoles: readonly AppRole[],
  client?: ServiceClient,
): Promise<SchoolAuthorization> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(schoolId)
  ) {
    throw new HttpError(
      "VALIDATION",
      "A valid school identifier is required.",
      400,
      {
        fieldErrors: [{
          field: "schoolId",
          message: "Enter a valid school identifier.",
        }],
      },
    );
  }

  const authenticated = await requireUser(request, client);
  const { data, error } = await authenticated.client
    .from("school_memberships")
    .select("role, active")
    .eq("school_id", schoolId)
    .eq("user_id", authenticated.user.id)
    .maybeSingle();

  if (error) {
    throw new HttpError(
      "UNAVAILABLE",
      "School access could not be verified. Please try again.",
      503,
      { retryable: true },
    );
  }

  if (!data || data.active !== true) {
    throw new HttpError(
      "FORBIDDEN",
      "You do not have an active membership in this school.",
      403,
    );
  }

  const role = data.role as AppRole;
  if (!allowedRoles.includes(role)) {
    throw new HttpError(
      "FORBIDDEN",
      "Your school role does not allow this action.",
      403,
    );
  }

  return {
    userId: authenticated.user.id,
    schoolId,
    role,
  };
}

function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();

  return Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]).then(([leftHash, rightHash]) => {
    const a = new Uint8Array(leftHash);
    const b = new Uint8Array(rightHash);
    let difference = 0;

    for (let index = 0; index < a.length; index += 1) {
      difference |= a[index] ^ b[index];
    }

    return difference === 0;
  });
}

export async function requireCronSecret(
  request: Request,
  secretName = "CRON_SECRET",
): Promise<void> {
  const expected = Deno.env.get(secretName);
  const supplied = request.headers.get("x-cron-secret");

  if (!expected || expected.length < 32 || !supplied) {
    throw new HttpError(
      "UNAUTHENTICATED",
      "The scheduled request could not be authenticated.",
      401,
    );
  }

  if (!(await constantTimeEqual(supplied, expected))) {
    throw new HttpError(
      "UNAUTHENTICATED",
      "The scheduled request could not be authenticated.",
      401,
    );
  }
}
