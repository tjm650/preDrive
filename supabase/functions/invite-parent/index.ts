import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';
if (!url || !serviceKey || !anonKey) throw new Error('Missing Supabase function secrets');

const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
const textResponse = (body: string, status: number) =>
  new Response(body, { status, headers: corsHeaders });

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false } });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return textResponse('Method not allowed', 405);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return textResponse('Unauthorized', 401);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return textResponse('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    full_name?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() ?? '';
  const fullName = body?.full_name?.trim() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 120) {
    return jsonResponse({ error: 'Provide a valid parent name and email address.' }, 400);
  }

  const { data: inviter, error: inviterError } = await admin
    .from('profiles')
    .select('id,school_id,role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (inviterError || !inviter || inviter.role !== 'school_admin' || !inviter.school_id) {
    return textResponse('Forbidden', 403);
  }

  const { data: existing, error: existingError } = await admin
    .from('parent_invitations')
    .select('id,status,expires_at')
    .eq('school_id', inviter.school_id)
    .eq('email', email)
    .maybeSingle();
  if (existingError) return jsonResponse({ error: 'Unable to check existing invitations.' }, 500);
  if (existing?.status === 'invited' && new Date(existing.expires_at) > new Date()) {
    return jsonResponse(
      { error: 'An active parent invitation already exists for this email.' },
      409,
    );
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, school_id: inviter.school_id, role: 'parent' },
    redirectTo: siteUrl + '/login',
  });
  if (inviteError || !invited.user) {
    return jsonResponse(
      { error: inviteError?.message ?? 'Unable to create parent invitation.' },
      400,
    );
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: invited.user.id,
      school_id: inviter.school_id,
      role: 'parent',
      full_name: fullName,
    },
    { onConflict: 'id' },
  );
  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return jsonResponse(
      { error: 'Parent invitation could not be linked to a school profile.' },
      500,
    );
  }

  const { error: saveError } = await admin.from('parent_invitations').upsert(
    {
      school_id: inviter.school_id,
      email,
      full_name: fullName,
      invited_by: authData.user.id,
      invited_user_id: invited.user.id,
      status: 'invited',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'school_id,email' },
  );
  if (saveError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return jsonResponse({ error: 'Parent invitation record could not be saved.' }, 500);
  }

  await admin.from('audit_log').insert({
    school_id: inviter.school_id,
    actor_id: authData.user.id,
    action: 'parent_invited',
    entity_type: 'profile',
    entity_id: invited.user.id,
    metadata: { email },
  });
  return jsonResponse({ invited: true, email });
});
