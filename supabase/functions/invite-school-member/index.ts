import { requireSchoolRole } from "../_shared/auth.ts";
import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import {
  SCHOOL_INVITATION_TTL_MS,
  hashInvitationRateLimitSubject,
  schoolInvitationSchema,
} from "../_shared/invitations.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError(
      "VALIDATION",
      "Only POST requests are supported.",
      405,
    );
  }

  const body = await parseJsonBody(request, schoolInvitationSchema);
  const client = createServiceClient();

  const actor = await requireSchoolRole(
    request,
    body.schoolId,
    ["school_admin"],
    client,
  );

  const rateLimitSubject = await hashInvitationRateLimitSubject(
    actor.schoolId,
    actor.userId,
  );
  const { data: rateLimitAllowed, error: rateLimitError } = await client.rpc(
    "consume_rate_limit",
    {
      p_school_id: actor.schoolId,
      p_action: "school.invitation.create",
      p_subject_hash: rateLimitSubject,
      p_limit: 10,
      p_window_seconds: 900,
    },
  );

  if (rateLimitError) throw rateLimitError;
  if (rateLimitAllowed !== true) {
    throw new HttpError(
      "RATE_LIMITED",
      "Too many invitations have been created. Wait 15 minutes before trying again.",
      429,
      { retryable: true },
    );
  }

  const { data: school, error: schoolError } = await client
    .from("schools")
    .select("id, status")
    .eq("id", actor.schoolId)
    .maybeSingle();

  if (schoolError) throw schoolError;
  if (!school || school.status !== "active") {
    throw new HttpError(
      "CONFLICT",
      "Invitations are available after the school account is active.",
      409,
    );
  }

  const emailPattern = body.email.replace(
    /[\\%_]/g,
    (character) => "\\" + character,
  );
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id")
    .ilike("email", emailPattern)
    .maybeSingle();

  if (profileError) throw profileError;

  if (profile) {
    const { data: membership, error: membershipError } = await client
      .from("school_memberships")
      .select("id, role, active")
      .eq("school_id", actor.schoolId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (membership?.active) {
      throw new HttpError(
        "CONFLICT",
        "This person is already an active member of the school.",
        409,
      );
    }
    if (membership && membership.role !== body.role) {
      throw new HttpError(
        "CONFLICT",
        "The existing membership has a different role and needs administrator review.",
        409,
      );
    }
  }

  const expiresAt = new Date(Date.now() + SCHOOL_INVITATION_TTL_MS).toISOString();
  const { data: invitation, error: insertError } = await client
    .from("school_invitations")
    .insert({
      school_id: actor.schoolId,
      email: body.email,
      role: body.role,
      status: "pending",
      full_name: body.fullName ?? null,
      phone: body.phone ?? null,
      expires_at: expiresAt,
      invited_by: actor.userId,
    })
    .select("id, expires_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new HttpError(
        "CONFLICT",
        "A pending invitation already exists for this email address.",
        409,
      );
    }
    throw insertError;
  }

  if (!profile) {
    const { error: inviteError } = await client.auth.admin.inviteUserByEmail(
      body.email,
      body.fullName ? { data: { full_name: body.fullName } } : undefined,
    );

    if (inviteError) {
      const { error: cleanupError } = await client
        .from("school_invitations")
        .delete()
        .eq("id", invitation.id);

      if (cleanupError) {
        throw new HttpError(
          "UNAVAILABLE",
          "The invitation could not be completed. Contact support before retrying.",
          503,
        );
      }

      throw new HttpError(
        "UNAVAILABLE",
        "The invitation email could not be sent. Please try again.",
        503,
        { retryable: true },
      );
    }
  }

  return jsonOk({
    invitationId: invitation.id,
    expiresAt: invitation.expires_at,
    status: "pending",
  }, 201);
}, "invite-school-member");

Deno.serve(handler);
