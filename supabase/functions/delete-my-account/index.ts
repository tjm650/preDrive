import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('Missing required Edge Function secrets');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  Vary: 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const origin = request.headers.get('origin');
  if (origin && origin !== siteUrl) return jsonResponse({ error: 'Origin not allowed' }, 403);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const body = (await request.json().catch(() => null)) as { confirm_email?: string } | null;
  const confirmation = body?.confirm_email?.trim().toLowerCase();
  const accountEmail = user.email?.trim().toLowerCase();
  if (!accountEmail || confirmation !== accountEmail) {
    return jsonResponse({ error: 'Enter your account email exactly to confirm deletion.' }, 400);
  }

  const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  if (!lastSignInAt || Date.now() - lastSignInAt > 15 * 60 * 1000) {
    return jsonResponse({ error: 'For security, sign in again before deleting your account.' }, 401);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,school_id,role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) return jsonResponse({ error: 'Profile not found.' }, 404);

  // School staff and platform-owner accounts must be offboarded by their organization.
  if (profile.role !== 'parent') {
    return jsonResponse({
      error: 'Self-service deletion is available for parent accounts only. Contact your school administrator to offboard a staff account.',
    }, 403);
  }

  const { data: links, error: linksError } = await admin
    .from('guardianships')
    .select('child_id')
    .eq('guardian_id', user.id);
  if (linksError) return jsonResponse({ error: 'Unable to verify guardian relationships.' }, 500);

  const childIds = [...new Set((links ?? []).map((item) => item.child_id).filter(Boolean))] as string[];
  if (childIds.length) {
    const { data: alternateLinks, error: alternateError } = await admin
      .from('guardianships')
      .select('child_id')
      .in('child_id', childIds)
      .neq('guardian_id', user.id);
    if (alternateError) return jsonResponse({ error: 'Unable to verify alternate guardians.' }, 500);

    const protectedChildren = new Set((alternateLinks ?? []).map((item) => item.child_id));
    const orphanedCount = childIds.filter((childId) => !protectedChildren.has(childId)).length;
    if (orphanedCount > 0) {
      return jsonResponse({
        error: 'Your account cannot be deleted yet because at least one child has no other registered guardian. Ask the school to add another guardian first.',
        children_requiring_another_guardian: orphanedCount,
      }, 409);
    }
  }

  // Preserve school records while removing the departing parent's direct identifiers.
  const cleanup = await Promise.all([
    admin.from('audit_log').update({ actor_id: null }).eq('actor_id', user.id),
    admin.from('absences').update({ reported_by: null }).eq('reported_by', user.id),
    admin.from('incidents').update({ reported_by: null }).eq('reported_by', user.id),
    admin.from('invoices').update({ guardian_id: null }).eq('guardian_id', user.id),
    admin.from('messages').delete().eq('sender_id', user.id),
  ]);
  const cleanupError = cleanup.find((result) => result.error)?.error;
  if (cleanupError) {
    console.error(JSON.stringify({
      event: 'account_deletion_cleanup_failed',
      user_id: user.id,
      message: cleanupError.message,
    }));
    return jsonResponse({ error: 'Account records could not be prepared for deletion. No account deletion was attempted.' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(JSON.stringify({
      event: 'account_deletion_failed',
      user_id: user.id,
      message: deleteError.message,
    }));
    return jsonResponse({
      error: 'Your account could not be deleted. Some authored messages and identifying links were already removed; sign in again and retry or contact support.',
    }, 500);
  }

  console.log(JSON.stringify({
    event: 'account_deleted',
    user_id: user.id,
    school_id: profile.school_id,
    deleted_at: new Date().toISOString(),
  }));

  return jsonResponse({ deleted: true });
});
