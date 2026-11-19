import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
if (!supabaseUrl || !serviceKey || !webhookSecret)
  throw new Error('Missing required Edge Function secrets');
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const copy: Record<string, Record<string, string>> = {
  en: {
    boarded: 'Your child has boarded the bus',
    arrived_school: 'Your child has arrived at school',
    dropped_home: 'Your child has been dropped home',
    absent: 'Your child was marked absent',
    delay: 'The trip has been delayed',
    sos: "Emergency alert from your child's trip",
    handover_rejected: 'A child handover was rejected',
    bus_near: "Your child's bus is approaching home",
    arrived: "Your child's bus has arrived",
    child_unaccounted: 'A child has not been accounted for at trip end',
    child_missing:
      'A child has been reported missing during the trip. Contact the school immediately.',
    bus_location_stale: 'The bus location has not updated for more than 60 seconds.',
  },
  sn: {
    boarded: 'Mwana wenyu apinda mubhazi',
    arrived_school: 'Mwana wenyu asvika kuchikoro',
    dropped_home: 'Mwana wenyu asvika kumba',
    absent: 'Mwana wenyu anyorwa seasipo',
    delay: 'Rwendo rwambononoka',
    sos: 'Yambiro yechimbichimbi parwendo rwemwana wenyu',
    handover_rejected: 'Kupihwa kwemwana kwarambwa',
    bus_near: 'Bhazi remwana wenyu rava pedyo nekumba',
    arrived: 'Bhazi remwana wenyu rasvika',
    child_unaccounted: 'Mwana haasati asimbiswa pakupera kwerwendo',
    child_missing: 'Mwana anonzi arasika parwendo. Bata chikoro nekukasika.',
    bus_location_stale: 'Nzvimbo yebhazi haina kuvandudzwa kwemasekonzi anodarika 60.',
  },
  nd: {
    boarded: 'Umntwana wakho ugibele ibhasi',
    arrived_school: 'Umntwana wakho ufikile esikolo',
    dropped_home: 'Umntwana wakho ufikisiwe ekhaya',
    absent: 'Umntwana wakho ubhalwe njengongafikanga',
    delay: 'Uhambo lubambezeleke',
    sos: 'Isixwayiso esiphuthumayo ohambweni lomntwana wakho',
    handover_rejected: 'Ukunikezelwa komntwana kwaliwe',
    bus_near: 'Ibhasi yomntwana wakho isisondela ekhaya',
    arrived: 'Ibhasi yomntwana wakho isifikile',
    child_unaccounted: 'Umntwana akaqinisekiswanga ekupheleni kohambo',
    child_missing: 'Kubikwe ukuthi umntwana ulahlekile ohambweni. Thinta isikolo masinyane.',
    bus_location_stale: 'Indawo yebhasi ayikavuselelwa imizuzwana engaphezu kuka-60.',
  },
};
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (request.headers.get('x-webhook-secret') !== webhookSecret)
    return new Response('Unauthorized', { status: 401 });
  const payload: unknown = await request.json();
  const record = (payload as { record?: Record<string, unknown> }).record;
  if (!record || typeof record.user_id !== 'string' || typeof record.id !== 'string')
    return Response.json({ error: 'Invalid notification payload' }, { status: 400 });
  const { data: profile, error } = await admin
    .from('profiles')
    .select('expo_push_token,language')
    .eq('id', record.user_id)
    .maybeSingle();
  if (error) return Response.json({ error: 'Unable to load recipient' }, { status: 500 });
  if (!profile?.expo_push_token) return Response.json({ skipped: 'no_push_token' });
  const language =
    typeof profile.language === 'string' && profile.language in copy ? profile.language : 'en';
  const bodyKey = String(record.body_key ?? 'notification');
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title: ['sos', 'child_missing', 'child_unaccounted', 'handover_rejected'].includes(bodyKey)
        ? 'preDrive · Safety alert'
        : 'preDrive',
      body: copy[language]?.[bodyKey] ?? 'You have a new school transport update.',
      data: { notificationId: record.id, type: record.type },
      priority: record.priority === 'critical' || record.priority === 'high' ? 'high' : 'default',
      sound: 'default',
    }),
  });
  const result = (await response.json()) as {
    data?: { status?: string; id?: string; details?: { error?: string } };
    errors?: unknown[];
  };
  if (!response.ok || result.errors?.length)
    return Response.json({ error: 'Expo push request failed', result }, { status: 502 });
  if (result.data?.status === 'error' && result.data.details?.error === 'DeviceNotRegistered') {
    await admin.from('profiles').update({ expo_push_token: null }).eq('id', record.user_id);
  }
  if (result.data?.status === 'ok' && result.data.id) {
    const { error: receiptError } = await admin.from('push_receipts').insert({
      notification_id: record.id,
      user_id: record.user_id,
      expo_ticket_id: result.data.id,
    });
    if (receiptError)
      return Response.json(
        { accepted: true, warning: 'Push accepted but receipt ticket could not be persisted' },
        { status: 202 },
      );
  }
  return Response.json({
    accepted: result.data?.status === 'ok',
    ticket: result.data?.id ?? result.data?.status ?? 'unknown',
  });
});
