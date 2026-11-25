import type { AuthSessionSource } from "../auth/session";
import type { AuthenticatedSession } from "../auth/session-validation";
import { mobileSupabase } from "./supabase/client";
import { mobileSupabaseRuntime } from "./supabase/runtime";

async function getSnapshot(): Promise<AuthenticatedSession | null> {
  if (!mobileSupabaseRuntime) return null;
  const result = await mobileSupabaseRuntime.auth.getSession();
  if (!result.ok || !result.data?.activeSchool) return null;

  const membership = result.data.memberships.find(
    (item) => item.schoolId === result.data?.activeSchool?.id && item.active,
  );
  if (!membership) return null;

  return {
    userId: result.data.user.id,
    schoolId: result.data.activeSchool.id,
    role: membership.role,
    expiresAt: result.data.expiresAt,
  };
}

/** Adapts the shared Supabase session to the existing Expo auth gate. */
export const mobileAuthSessionSource: AuthSessionSource | undefined =
  mobileSupabase && mobileSupabaseRuntime
    ? {
        getSnapshot,
        subscribe(listener) {
          const {
            data: { subscription },
          } = mobileSupabase.auth.onAuthStateChange(() => {
            // Defer SDK reads until after the auth callback returns.
            void Promise.resolve()
              .then(getSnapshot)
              .then(listener)
              .catch(() => listener(null));
          });
          return () => subscription.unsubscribe();
        },
      }
    : undefined;
