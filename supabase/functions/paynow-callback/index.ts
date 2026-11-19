import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase server secrets');

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const textResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

async function sha512(value: string) {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function expectedHash(fields: URLSearchParams) {
  let valueString = '';
  for (const [key, value] of fields.entries()) {
    if (key.toLowerCase() !== 'hash') valueString += value;
  }
  return sha512(valueString + integrationKey);
}

function field(fields: URLSearchParams, name: string) {
  for (const [key, value] of fields.entries()) {
    if (key.toLowerCase() === name.toLowerCase()) return value;
  }
  return null;
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return textResponse('Method not allowed', 405);
  if (!integrationKey) return textResponse('Paynow callback is not configured', 503);

  const rawBody = await request.text();
  if (rawBody.length > 16000) return textResponse('Payload too large', 413);
  const fields = new URLSearchParams(rawBody);
  const receivedHash = field(fields, 'hash');
  const reference = field(fields, 'reference');
  const amountText = field(fields, 'amount');
  const providerStatus = field(fields, 'status')?.trim().toLowerCase();
  const paynowReference = field(fields, 'paynowreference');

  if (!receivedHash || !reference || !amountText || !providerStatus) {
    return textResponse('Missing required callback fields', 400);
  }

  const calculatedHash = await expectedHash(fields);
  if (!constantTimeEqual(receivedHash.toUpperCase(), calculatedHash)) {
    console.error(JSON.stringify({ event: 'paynow_callback_rejected', reason: 'invalid_hash' }));
    return textResponse('Invalid callback signature', 401);
  }

  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    return textResponse('Invalid callback amount', 400);
  }

  try {
    const { data: transaction, error: transactionError } = await admin
      .from('paynow_transactions')
      .select('payment_id,merchant_reference,status')
      .eq('merchant_reference', reference)
      .maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction) return textResponse('Unknown reference', 404);

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id,invoice_id,amount,currency,status,provider_reference')
      .eq('id', transaction.payment_id)
      .eq('provider', 'paynow')
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.provider_reference !== reference) return textResponse('Payment not found', 404);
    if (Math.abs(Number(payment.amount) - amount) >= 0.005) {
      console.error(JSON.stringify({
        event: 'paynow_callback_amount_mismatch',
        payment_id: payment.id,
        expected: payment.amount,
        received: amountText,
      }));
      return textResponse('Amount mismatch', 400);
    }

    if (payment.status === 'succeeded') return textResponse('OK');

    let nextStatus: 'pending' | 'succeeded' | 'failed' = 'pending';
    if (providerStatus === 'paid') nextStatus = 'succeeded';
    else if (['cancelled', 'failed', 'disputed', 'refunded'].includes(providerStatus)) nextStatus = 'failed';

    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select('id,school_id,amount_usd,currency,status')
      .eq('id', payment.invoice_id)
      .maybeSingle();
    if (invoiceError) throw invoiceError;
    if (!invoice) return textResponse('Invoice not found', 404);
    if (String(invoice.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
      return textResponse('Currency mismatch', 400);
    }

    const { error: paymentUpdateError } = await admin.from('payments').update({
      status: nextStatus,
      paid_at: nextStatus === 'succeeded' ? new Date().toISOString() : null,
    }).eq('id', payment.id);
    if (paymentUpdateError) throw paymentUpdateError;

    const { error: transactionUpdateError } = await admin.from('paynow_transactions').update({
      paynow_reference: paynowReference,
      status: nextStatus,
    }).eq('payment_id', payment.id);
    if (transactionUpdateError) throw transactionUpdateError;

    if (nextStatus === 'succeeded') {
      const { data: successfulPayments, error: totalError } = await admin
        .from('payments').select('amount').eq('invoice_id', invoice.id).eq('status', 'succeeded');
      if (totalError) throw totalError;
      const paidTotal = (successfulPayments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
      if (paidTotal + 0.0001 >= Number(invoice.amount_usd)) {
        const { error: invoiceUpdateError } = await admin.from('invoices')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', invoice.id)
          .in('status', ['pending', 'overdue']);
        if (invoiceUpdateError) throw invoiceUpdateError;
      }
    }

    await admin.from('audit_log').insert({
      school_id: invoice.school_id,
      actor_id: null,
      action: `paynow_payment_${nextStatus}`,
      entity_type: 'payment',
      entity_id: payment.id,
      metadata: {
        invoice_id: invoice.id,
        provider_reference: paynowReference,
        amount,
        currency: payment.currency,
        provider_status: providerStatus,
      },
    });

    console.log(JSON.stringify({
      event: 'paynow_callback_processed',
      payment_id: payment.id,
      invoice_id: invoice.id,
      status: nextStatus,
    }));
    return textResponse('OK');
  } catch (error) {
    console.error(JSON.stringify({
      event: 'paynow_callback_failed',
      reference,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
    return textResponse('Processing error', 500);
  }
});
