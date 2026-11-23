import {
  SCHOOL_INVITATION_TTL_MS,
  hashInvitationRateLimitSubject,
  schoolInvitationSchema,
} from "./invitations.ts";

Deno.test("school invitation normalizes email and accepts permitted roles", () => {
  const result = schoolInvitationSchema.safeParse({
    schoolId: "a2b4c6d8-1234-4234-8234-123456789abc",
    email: "  Parent@Example.com ",
    role: "guardian",
  });

  if (!result.success) throw new Error("Expected a valid invitation request.");
  if (result.data.email !== "parent@example.com") {
    throw new Error("Email must be normalized.");
  }
});

Deno.test("school invitation rejects school-admin role escalation", () => {
  const result = schoolInvitationSchema.safeParse({
    schoolId: "a2b4c6d8-1234-4234-8234-123456789abc",
    email: "person@example.com",
    role: "school_admin",
  });

  if (result.success) {
    throw new Error("School-admin invitations must not be accepted.");
  }
});

Deno.test("school invitation rejects unknown request fields", () => {
  const result = schoolInvitationSchema.safeParse({
    schoolId: "a2b4c6d8-1234-4234-8234-123456789abc",
    email: "person@example.com",
    role: "teacher",
    invitedBy: "caller-controlled",
  });

  if (result.success) throw new Error("Unknown fields must be rejected.");
});

Deno.test("school invitation expires after seven days", () => {
  if (SCHOOL_INVITATION_TTL_MS !== 604800000) {
    throw new Error("Invitation lifetime must remain seven days.");
  }
});

Deno.test("invitation rate-limit subject is a stable SHA-256 digest", async () => {
  const first = await hashInvitationRateLimitSubject(
    "a2b4c6d8-1234-4234-8234-123456789abc",
    "b2b4c6d8-1234-4234-8234-123456789abc",
  );
  const second = await hashInvitationRateLimitSubject(
    "a2b4c6d8-1234-4234-8234-123456789abc",
    "b2b4c6d8-1234-4234-8234-123456789abc",
  );
  if (first !== second || !/^[a-f0-9]{64}$/.test(first)) {
    throw new Error("Expected a deterministic lowercase SHA-256 digest.");
  }
});

Deno.test("staff invitations require a name and Zimbabwe-style contact number", () => {
  const missingDetails = schoolInvitationSchema.safeParse({
    schoolId: "a2b4c6d8-1234-4234-8234-123456789abc",
    email: "driver@example.com",
    role: "driver",
  });
  if (missingDetails.success) {
    throw new Error("Staff invitations must require name and phone.");
  }

  const validStaff = schoolInvitationSchema.safeParse({
    schoolId: "a2b4c6d8-1234-4234-8234-123456789abc",
    email: "driver@example.com",
    role: "driver",
    fullName: "Tafadzwa Moyo",
    phone: "+263 77 123 4567",
  });
  if (!validStaff.success) {
    throw new Error("Expected valid staff contact details.");
  }
});
