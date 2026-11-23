import { requireCronSecret } from "../_shared/auth.ts";
import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  addCalendarDays,
  dateInTimeZone,
  paymentReminderCopy,
  paymentReminderStage,
} from "../_shared/finance.ts";

interface SchoolRow {
  id: string;
  timezone: string;
}

interface InvoiceRow {
  id: string;
  school_id: string;
  guardian_user_id: string;
  invoice_number: string;
  currency: "USD" | "ZiG";
  balance_minor: number | string;
  due_date: string;
}

const PAGE_SIZE = 500;

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError(
      "VALIDATION",
      "Only POST requests are supported.",
      405,
    );
  }

  await requireCronSecret(request);
  const serviceClient = createServiceClient();

  const { data: schools, error: schoolsError } = await serviceClient
    .from("schools")
    .select("id, timezone")
    .eq("status", "active");

  if (schoolsError) throw schoolsError;

  let invoicesScanned = 0;
  let remindersCreated = 0;
  let recipientsCreated = 0;
  let skippedInvoices = 0;

  for (const school of (schools ?? []) as SchoolRow[]) {
    const today = dateInTimeZone(new Date(), school.timezone);
    const earliestDate = addCalendarDays(today, -30);
    const latestDate = addCalendarDays(today, 3);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: invoiceRows, error: invoicesError } = await serviceClient
        .from("invoices")
        .select(
          "id, school_id, guardian_user_id, invoice_number, currency, balance_minor, due_date",
        )
        .eq("school_id", school.id)
        .in("status", ["issued", "partially_paid", "overdue"])
        .gt("balance_minor", 0)
        .gte("due_date", earliestDate)
        .lte("due_date", latestDate)
        .order("due_date", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (invoicesError) throw invoicesError;
      const invoices = (invoiceRows ?? []) as InvoiceRow[];
      invoicesScanned += invoices.length;

      for (const invoice of invoices) {
        const stage = paymentReminderStage(invoice.due_date, today);
        if (!stage) continue;

        const amountMinor = Number(invoice.balance_minor);
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
          skippedInvoices += 1;
          continue;
        }

        const { data: membership, error: membershipError } = await serviceClient
          .from("school_memberships")
          .select("user_id")
          .eq("school_id", school.id)
          .eq("user_id", invoice.guardian_user_id)
          .eq("role", "guardian")
          .eq("active", true)
          .maybeSingle();

        if (membershipError) throw membershipError;
        if (!membership) {
          skippedInvoices += 1;
          continue;
        }

        const copy = paymentReminderCopy({
          stage,
          invoiceNumber: invoice.invoice_number,
          amountMinor,
          currency: invoice.currency,
          dueDate: invoice.due_date,
        });
        const dedupeKey = "payment-reminder:" + invoice.id + ":" + stage;

        const { data: createdAlert, error: createAlertError } =
          await serviceClient
            .from("alerts")
            .insert({
              school_id: school.id,
              title: copy.title,
              message: copy.message,
              severity: "warning",
              status: "open",
              source_type: "payment_reminder",
              source_id: invoice.id,
              dedupe_key: dedupeKey,
              repeat_until_acknowledged: false,
            })
            .select("id")
            .maybeSingle();

        let alertId = createdAlert?.id as string | undefined;

        if (createAlertError?.code === "23505") {
          const { data: existingAlert, error: existingAlertError } =
            await serviceClient
              .from("alerts")
              .select("id")
              .eq("school_id", school.id)
              .eq("dedupe_key", dedupeKey)
              .maybeSingle();

          if (existingAlertError) throw existingAlertError;
          alertId = existingAlert?.id;
        } else if (createAlertError) {
          throw createAlertError;
        }

        if (!alertId) {
          throw new HttpError(
            "UNAVAILABLE",
            "A payment reminder could not be confirmed.",
            503,
            { retryable: true },
          );
        }

        if (createdAlert) remindersCreated += 1;

        const { error: recipientError } = await serviceClient
          .from("alert_recipients")
          .upsert(
            {
              school_id: school.id,
              alert_id: alertId,
              recipient_user_id: invoice.guardian_user_id,
            },
            {
              onConflict: "school_id,alert_id,recipient_user_id",
              ignoreDuplicates: true,
            },
          );

        if (recipientError) throw recipientError;
        recipientsCreated += 1;
      }

      if (invoices.length < PAGE_SIZE) break;
    }
  }

  return jsonOk({
    schoolsProcessed: (schools ?? []).length,
    invoicesScanned,
    remindersCreated,
    recipientsEnsured: recipientsCreated,
    skippedInvoices,
    serviceDateBasis: "Each school's configured time zone",
  });
}, "generate-payment-reminders");

Deno.serve(handler);
