import { z } from "./validation.ts";

export const schoolInvitationSchema = z.object({
  schoolId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["guardian", "teacher", "supervisor", "driver"]),
  fullName: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,30}$/).optional(),
}).strict().superRefine((value, context) => {
  if (value.role !== "guardian" && !value.fullName) {
    context.addIssue({
      code: "custom",
      path: ["fullName"],
      message: "A full name is required for staff invitations.",
    });
  }
  if (value.role !== "guardian" && !value.phone) {
    context.addIssue({
      code: "custom",
      path: ["phone"],
      message: "A phone number is required for staff invitations.",
    });
  }
});

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
