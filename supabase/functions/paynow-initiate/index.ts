import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';
const integrationId = Deno.env.get('PAYNOW_INTEGRATION_ID');
const integrationKey = Deno.env.get('PAYNOW_INTEGRATION_KEY');
const paynowBase = Deno.env.get('PAYNOW_API_BASE') ?? 'https://www.paynow.co.zw';

if (!url || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase Edge Function secrets');

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function sha512(value: string) {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function paynowHash(fields: URLSearchParams) {
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
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== siteUrl) return jsonResponse({ error: 'Origin not allowed' }, 403);
  if (!integrationId || !integrationKey) return jsonResponse({ error: 'Paynow is not configured on the server.' }, 503);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => null) as {
    invoice_id?: string;
    method?: string;
    phone?: string;
    idempotency_key?: string;
  } | null;
  const invoiceId = body?.invoice_id?.trim();
  const method = (body?.method ?? 'web').toLowerCase();
  const idempotencyKey = body?.idempotency_key?.trim();
  const phone = body?.phone?.trim();

  if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return jsonResponse({ error: 'A valid invoice_id is required.' }, 400);
  if (!['web', 'ecocash', 'onemoney'].includes(method)) return jsonResponse({ error: 'Unsupported Paynow payment method.' }, 400);
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return jsonResponse({ error: 'An idempotency_key between 8 and 128 characters is required.' }, 400);
  }
  if (method !== 'web' && (!phone || !/^\+?[0-9]{9,15}$/.test(phone))) {
    return jsonResponse({ error: 'Enter a valid mobile money phone number.' }, 400);
  }

  try {
    const { data: profile, error: profileError } = await admin
      .from('profiles').select('id,school_id,role').eq('id', user.id).maybeSingle();
    if (profileError || !profile || profile.role !== 'parent' || !profile.school_id) {
      return jsonResponse({ error: 'Only an enrolled parent can pay an invoice.' }, 403);
    }

    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select('id,school_id,guardian_id,amount_usd,currency,status')
      .eq('id', invoiceId)
      .eq('guardian_id', user.id)
      .maybeSingle();
    if (invoiceError || !invoice) return jsonResponse({ error: 'Invoice not found.' }, 404);
    if (invoice.school_id !== profile.school_id) return jsonResponse({ error: 'Invoice tenant mismatch.' }, 403);

    const { data: school, error: schoolError } = await admin
      .from('schools').select('status').eq('id', invoice.school_id).maybeSingle();
    if (schoolError || !school || school.status !== 'active') return jsonResponse({ error: 'This school is not accepting payments.' }, 403);
    if (!['pending', 'overdue'].includes(String(invoice.status))) return jsonResponse({ error: 'This invoice is not payable.' }, 409);

    const { data: existing, error: existingError } = await admin
      .from('payments')
      .select('id,status,amount,currency')
      .eq('invoice_id', invoice.id)
      .eq('provider', 'paynow')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { data: tx } = await admin.from('paynow_transactions')
        .select('merchant_reference,browser_url,status')
        .eq('payment_id', existing.id).maybeSingle();
      if (existing.status === 'succeeded') return jsonResponse({ payment_id: existing.id, status: 'succeeded' });
      if (tx?.browser_url) {
        return jsonResponse({
          payment_id: existing.id,
          reference: tx.merchant_reference,
          checkout_url: tx.browser_url,
          amount: existing.amount,
          currency: existing.currency,
          status: tx.status,
          reused: true,
        });
      }
      return jsonResponse({ error: 'This payment request is already being processed. Retry shortly.' }, 409);
    }

    const { count: recentCount, error: rateError } = await admin
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', invoice.id)
      .eq('provider', 'paynow')
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (rateError) throw rateError;
    if ((recentCount ?? 0) >= 5) return jsonResponse({ error: 'Too many payment attempts. Try again later.' }, 429);

    const { data: successfulPayments, error: paymentsError } = await admin
      .from('payments').select('amount').eq('invoice_id', invoice.id).eq('status', 'succeeded');
    if (paymentsError) throw paymentsError;
    const paid = (successfulPayments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const outstanding = Math.max(0, Number(invoice.amount_usd) - paid);
    if (outstanding <= 0) return jsonResponse({ error: 'This invoice is already fully paid.' }, 409);
    const amount = outstanding.toFixed(2);
    const paymentId = crypto.randomUUID();
    const merchantReference = `PREDRIVE-${paymentId.toUpperCase()}`;

    const { error: paymentInsertError } = await admin.from('payments').insert({
      id: paymentId,
      invoice_id: invoice.id,
      amount,
      currency: String(invoice.currency).toUpperCase(),
      provider: 'paynow',
      provider_reference: merchantReference,
      method: method === 'web' ? 'paynow' : method,
      idempotency_key: idempotencyKey,
      status: 'pending',
    });
    if (paymentInsertError) {
      if (paymentInsertError.code === '23505') return jsonResponse({ error: 'This payment request was already submitted.' }, 409);
      throw paymentInsertError;
    }

    const { error: transactionInsertError } = await admin.from('paynow_transactions').insert({
      payment_id: paymentId,
      merchant_reference: merchantReference,
      status: 'initiating',
    });
    if (transactionInsertError) throw transactionInsertError;

    const resultUrl = `${url.replace(/\/$/, '')}/functions/v1/paynow-callback`;
    const returnUrl = Deno.env.get('PAYNOW_RETURN_URL') ?? siteUrl;
    const fields = new URLSearchParams();
    fields.set('id', integrationId);
    fields.set('reference', merchantReference);
    fields.set('amount', amount);
    fields.set('additionalinfo', `preDrive invoice ${invoice.id}`);
    fields.set('returnurl', returnUrl);
    fields.set('resulturl', resultUrl);
    if (user.email) fields.set('authemail', user.email);
    if (method !== 'web') {
      fields.set('phone', phone!);
      fields.set('method', method);
    }
    fields.set('status', 'Message');
    fields.set('hash', await paynowHash(fields));

    const endpoint = method === 'web' ? 'initiatetransaction' : 'remotetransaction';
    const response = await fetch(`${paynowBase.replace(/\/$/, '')}/interface/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fields.toString(),
      signal: AbortSignal.timeout(20000),
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Paynow HTTP ${response.status}`);

    const resultFields = new URLSearchParams(responseText);
    const responseHash = field(resultFields, 'hash');
    const expectedHash = await paynowHash(resultFields);
    if (!responseHash || !constantTimeEqual(responseHash.toUpperCase(), expectedHash)) {
      throw new Error('Paynow response hash verification failed');
    }

    const resultStatus = field(resultFields, 'status')?.toLowerCase();
    const checkoutUrl = field(resultFields, 'browserurl');
    const pollUrl = field(resultFields, 'pollurl');
    const paynowReference = field(resultFields, 'paynowreference');
    if (resultStatus !== 'ok' || !checkoutUrl || !pollUrl) {
      const providerError = field(resultFields, 'error') ?? 'Paynow could not initiate this payment.';
      await admin.from('payments').update({ status: 'failed' }).eq('id', paymentId);
      await admin.from('paynow_transactions').update({ status: 'failed' }).eq('payment_id', paymentId);
      return jsonResponse({ error: providerError }, 502);
    }

    const { error: txUpdateError } = await admin.from('paynow_transactions').update({
      paynow_reference: paynowReference,
      browser_url: checkoutUrl,
      poll_url: pollUrl,
      status: 'pending',
    }).eq('payment_id', paymentId);
    if (txUpdateError) throw txUpdateError;

    console.log(JSON.stringify({
      event: 'paynow_payment_initiated',
      user_id: user.id,
      invoice_id: invoice.id,
      payment_id: paymentId,
      method,
    }));

    return jsonResponse({
      payment_id: paymentId,
      reference: merchantReference,
      checkout_url: checkoutUrl,
      amount,
      currency: invoice.currency,
      status: 'pending',
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'paynow_initiate_failed',
      user_id: user.id,
      invoice_id: invoiceId,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
    return jsonResponse({ error: 'Unable to initiate payment. Please try again later.' }, 500);
  }
});
