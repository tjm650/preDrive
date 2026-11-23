import { z } from "./validation.ts";

export const schoolInvitationSchema = z.object({
  schoolId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["guardian", "teacher", "supervisor", "driver"]),
}).strict();

export type SchoolInvitationRequest = z.infer<typeof schoolInvitationSchema>;

export const SCHOOL_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function hashInvitationRateLimitSubject(
  schoolId: string,
  userId: string,
): Promise<string> {
  const input = new TextEncoder().encode(`${schoolId}:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
