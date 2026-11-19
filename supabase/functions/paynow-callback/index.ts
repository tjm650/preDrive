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
  const providerStatus = field(fields, 'status');
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
    const { data: result, error } = await admin.rpc('apply_paynow_callback', {
      p_merchant_reference: reference,
      p_paynow_reference: paynowReference,
      p_amount: amount,
      p_provider_status: providerStatus,
    });
    if (error) throw error;

    console.log(JSON.stringify({
      event: 'paynow_callback_processed',
      reference,
      status: result,
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
