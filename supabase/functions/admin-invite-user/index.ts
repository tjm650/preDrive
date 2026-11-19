import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';
if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase Edge Function secrets');

const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const origin = request.headers.get('origin');
  if (origin && origin !== siteUrl) return new Response('Origin not allowed', { status: 403, headers: corsHeaders });

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null) as { role?: string } | null;
  const role = body?.role?.toLowerCase();
  const target = role === 'parent'
    ? 'invite-parent'
    : ['supervisor', 'school_admin'].includes(role ?? '')
      ? 'invite-staff'
      : null;

  if (!target) {
    return new Response(JSON.stringify({ error: 'Role must be parent, supervisor or school_admin.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${target}`, {
    method: 'POST',
    headers: {
      authorization,
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
});
