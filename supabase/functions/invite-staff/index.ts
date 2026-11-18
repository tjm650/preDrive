import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';
if (!url || !serviceKey || !anonKey) throw new Error('Missing Supabase function secrets');

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false } });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const authorization = request.headers.get('authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return new Response('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null) as {
    email?: string; full_name?: string; role?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() ?? '';
  const fullName = body?.full_name?.trim() ?? '';
  const role = body?.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 120 ||
      (role !== 'supervisor' && role !== 'school_admin')) {
    return Response.json({ error: 'Provide a valid email, full name and staff role.' }, { status: 400 });
  }

  const { data: inviter, error: inviterError } = await admin
    .from('profiles').select('id,school_id,role').eq('id', authData.user.id).maybeSingle();
  if (inviterError || !inviter || inviter.role !== 'school_admin' || !inviter.school_id) {
    return new Response('Forbidden', { status: 403 });
  }

  const { data: existing } = await admin.from('profiles').select('id').eq('id', authData.user.id).maybeSingle();
  if (!existing) return new Response('Forbidden', { status: 403 });

  const { data: invitation, error: invitationError } = await admin
    .from('staff_invitations')
    .select('id,status,expires_at')
    .eq('school_id', inviter.school_id)
    .eq('email', email)
    .maybeSingle();
  if (invitation && invitation.status === 'invited' && new Date(invitation.expires_at) > new Date()) {
    return Response.json({ error: 'An active invitation already exists for this email.' }, { status: 409 });
  }
  if (invitationError) return Response.json({ error: 'Unable to check existing invitations.' }, { status: 500 });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, school_id: inviter.school_id, role },
    redirectTo: siteUrl + '/login',
  });
  if (inviteError || !invited.user) {
    return Response.json({ error: inviteError?.message ?? 'Unable to create invitation.' }, { status: 400 });
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: invited.user.id, school_id: inviter.school_id, role, full_name: fullName,
  }, { onConflict: 'id' });
  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return Response.json({ error: 'Invitation could not be linked to a school profile.' }, { status: 500 });
  }

  const { error: saveError } = await admin.from('staff_invitations').upsert({
    school_id: inviter.school_id, email, full_name: fullName, role,
    invited_by: authData.user.id, invited_user_id: invited.user.id, status: 'invited',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: 'school_id,email' });
  if (saveError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return Response.json({ error: 'Invitation record could not be saved.' }, { status: 500 });
  }

  await admin.from('audit_log').insert({
    school_id: inviter.school_id, actor_id: authData.user.id, action: 'staff_invited',
    entity_type: 'profile', entity_id: invited.user.id, metadata: { role, email },
  });
  return Response.json({ invited: true, role, email });
});
