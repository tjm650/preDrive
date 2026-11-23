import type { ServiceClient } from "./supabase.ts";
import {
  DATA_EXPORT_BUCKET,
  MAX_DATA_EXPORT_BYTES,
  dataExportObjectPath,
  utf8ByteLength,
} from "./privacy.ts";
import { HttpError } from "./errors.ts";

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value as Row[] : [];
}

async function requireQuery<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T> {
  const result = await query;
  if (result.error) throw result.error;
  if (result.data === null) {
    throw new HttpError("UNAVAILABLE", "The export could not be prepared.", 503, {
      retryable: true,
    });
  }
  return result.data;
}

export async function buildPersonalDataExport(
  client: ServiceClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const profile = await requireQuery(
    client.from("profiles")
      .select("id,full_name,email,phone,language,created_at,updated_at")
      .eq("id", userId)
      .maybeSingle(),
  );

  const memberships = asRows(await requireQuery(
    client.from("school_memberships")
      .select("id,school_id,role,active,created_at,updated_at")
      .eq("user_id", userId),
  ));

  const staffMemberships = asRows(await requireQuery(
    client.from("staff_members")
      .select("id,school_id,role,full_name,phone,active,created_at,updated_at")
      .eq("user_id", userId),
  ));

  const guardianLinks = asRows(await requireQuery(
    client.from("guardian_children")
      .select("id,school_id,guardian_user_id,child_id,relationship,primary_contact,active,notification_radius_meters,created_at,updated_at")
      .eq("guardian_user_id", userId),
  ));

  const childIds = [...new Set(guardianLinks
    .map((row) => row.child_id)
    .filter((value): value is string => typeof value === "string"))];

  const children = childIds.length
    ? asRows(await requireQuery(
      client.from("children")
        .select("id,school_id,class_group_id,first_name,last_name,date_of_birth,status,profile_image_path,created_at,updated_at")
        .in("id", childIds),
    ))
    : [];

  const collectors = childIds.length
    ? asRows(await requireQuery(
      client.from("approved_collectors")
        .select("id,school_id,child_id,full_name,relationship,phone,active,created_at,updated_at")
        .in("child_id", childIds),
    ))
    : [];

  const ownConsents = asRows(await requireQuery(
    client.from("consent_records")
      .select("id,school_id,subject_user_id,child_id,purpose,policy_version,status,captured_by,captured_at,effective_at,evidence,created_at")
      .eq("subject_user_id", userId),
  ));

  const childConsents = childIds.length
    ? asRows(await requireQuery(
      client.from("consent_records")
        .select("id,school_id,subject_user_id,child_id,purpose,policy_version,status,captured_by,captured_at,effective_at,evidence,created_at")
        .in("child_id", childIds),
    ))
    : [];

  const invoices = asRows(await requireQuery(
    client.from("invoices")
      .select("id,school_id,child_id,guardian_user_id,invoice_number,currency,subtotal_minor,credit_minor,total_minor,paid_minor,balance_minor,status,due_date,issued_at,paid_at,voided_at,notes,created_at,updated_at")
      .eq("guardian_user_id", userId),
  ));

  const invoiceIds = invoices
    .map((row) => row.id)
    .filter((value): value is string => typeof value === "string");

  const payments = invoiceIds.length
    ? asRows(await requireQuery(
      client.from("payments")
        .select("id,school_id,invoice_id,amount_minor,currency,method,status,reference,provider_reference,provider,exchange_rate_snapshot,succeeded_at,failed_at,cancelled_at,refunded_at,created_at,updated_at")
        .in("invoice_id", invoiceIds),
    ))
    : [];

  const tripChildren = childIds.length
    ? asRows(await requireQuery(
      client.from("trip_children")
        .select("id,school_id,trip_id,child_id,status,boarded_at,handed_over_at,recorded_by,last_event_at,created_at,updated_at")
        .in("child_id", childIds),
    ))
    : [];

  const tripIds = [...new Set(tripChildren
    .map((row) => row.trip_id)
    .filter((value): value is string => typeof value === "string"))];

  const trips = tripIds.length
    ? asRows(await requireQuery(
      client.from("trips")
        .select("id,school_id,route_id,bus_id,direction,service_date,status,scheduled_at,started_at,ended_at,cancelled_at,created_at,updated_at")
        .in("id", tripIds),
    ))
    : [];

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    subject: { userId },
    account: profile,
    schoolMemberships: memberships,
    staffRecords: staffMemberships,
    guardianChildLinks: guardianLinks,
    children,
    approvedCollectors: collectors,
    consentRecords: [...ownConsents, ...childConsents],
    invoices,
    payments,
    tripChildAttendance: tripChildren,
    relatedTrips: trips,
    exclusions: [
      "Handover PIN hashes and failed-attempt counters",
      "Device push tokens and authentication secrets",
      "Live and historical GPS coordinates",
      "Other guardians' profiles and unrelated school records",
      "Provider credentials, webhook payloads and internal idempotency hashes",
      "Safety, incident and audit records not directly linked to this personal export",
    ],
  };

  const serialized = JSON.stringify(result);
  if (utf8ByteLength(serialized) > MAX_DATA_EXPORT_BYTES) {
    throw new HttpError(
      "VALIDATION",
      "This export exceeds the secure file-size limit. Contact the school administrator for assistance.",
      413,
    );
  }

  return result;
}

export async function storePersonalDataExport(
  client: ServiceClient,
  schoolId: string,
  requestId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const path = dataExportObjectPath(schoolId, requestId);
  const serialized = JSON.stringify(payload, null, 2);
  if (utf8ByteLength(serialized) > MAX_DATA_EXPORT_BYTES) {
    throw new HttpError("VALIDATION", "The export is too large to store.", 413);
  }

  const { error } = await client.storage
    .from(DATA_EXPORT_BUCKET)
    .upload(path, new Blob([serialized], { type: "application/json" }), {
      contentType: "application/json",
      cacheControl: "0",
      upsert: true,
    });

  if (error) throw error;
  return path;
}
