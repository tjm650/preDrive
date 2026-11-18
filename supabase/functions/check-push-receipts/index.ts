import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
if (!url || !serviceKey || !webhookSecret)
  throw new Error('Missing required receipt worker secrets');
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (request.headers.get('x-webhook-secret') !== webhookSecret)
    return new Response('Unauthorized', { status: 401 });
  const { data: pending, error } = await admin
    .from('push_receipts')
    .select('id,user_id,expo_ticket_id')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .limit(100);
  if (error) return Response.json({ error: 'Unable to load pending receipts' }, { status: 500 });
  if (!pending?.length) return Response.json({ checked: 0 });
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify({ ids: pending.map((receipt) => receipt.expo_ticket_id) }),
  });
  if (!response.ok) return Response.json({ error: 'Expo receipt lookup failed' }, { status: 502 });
  const payload = (await response.json()) as {
    data?: Record<string, { status?: string; details?: { error?: string }; message?: string }>;
  };
  const receipts = payload.data ?? {};
  let checked = 0;
  for (const item of pending) {
    const receipt = receipts[item.expo_ticket_id];
    if (!receipt) continue;
    const status = receipt.status === 'ok' ? 'ok' : 'error';
    const errorCode = receipt.details?.error ?? receipt.message ?? null;
    await admin
      .from('push_receipts')
      .update({ status, error_code: errorCode, checked_at: new Date().toISOString() })
      .eq('id', item.id);
    if (errorCode === 'DeviceNotRegistered') {
      await admin.from('profiles').update({ expo_push_token: null }).eq('id', item.user_id);
    }
    checked += 1;
  }
  return Response.json({ checked, pending: pending.length });
});
