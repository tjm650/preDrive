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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

function uniqueById(items: Record<string, unknown>[]) {
  return [...new Map(items.filter((item) => typeof item.id === 'string').map((item) => [item.id, item])).values()];
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const origin = request.headers.get('origin');
  if (origin && origin !== siteUrl) return jsonResponse({ error: 'Origin not allowed' }, 403);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  try {
    const profileResult = await admin
      .from('profiles')
      .select('id,school_id,role,full_name,phone,language,avatar_url,created_at,updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (!profileResult.data) return jsonResponse({ error: 'Profile not found' }, 404);

    const profile = profileResult.data;
    const schoolId = profile.school_id as string | null;
    const guardianRows = await rows(
      admin.from('guardianships').select('id,child_id,relationship,created_at').eq('guardian_id', user.id),
    );
    const childIds = guardianRows.map((item) => item.child_id).filter((id): id is string => typeof id === 'string');

    const [
      schoolRows,
      children,
      authorizedPickups,
      guardianEvents,
      recordedEvents,
      guardianAbsences,
      reportedAbsences,
      ownInvoices,
      ownNotifications,
      ownThreads,
      ownThreadMembers,
      authoredMessages,
      ownTrips,
      ownIncidents,
      reportedIncidents,
      ownAuditLog,
      staffInvitations,
      parentInvitations,
      ownSubscription,
      ownSettings,
    ] = await Promise.all([
      schoolId ? rows(admin.from('schools').select('id,name,slug,address,phone,email,timezone,status,created_at,updated_at').eq('id', schoolId)) : Promise.resolve([]),
      childIds.length ? rows(admin.from('children').select('id,school_id,first_name,class_name,avatar_key,allergies,medical_notes,emergency_contact_name,emergency_contact_phone,home_stop_id,home_radius_m,archived_at,created_at,updated_at').in('id', childIds)) : Promise.resolve([]),
      childIds.length ? rows(admin.from('authorized_pickups').select('id,child_id,name,relationship,phone,active,created_at,updated_at').in('child_id', childIds)) : Promise.resolve([]),
      childIds.length ? rows(admin.from('trip_events').select('*').in('child_id', childIds)) : Promise.resolve([]),
      rows(admin.from('trip_events').select('*').eq('recorded_by', user.id)),
      childIds.length ? rows(admin.from('absences').select('*').in('child_id', childIds)) : Promise.resolve([]),
      rows(admin.from('absences').select('*').eq('reported_by', user.id)),
      rows(admin.from('invoices').select('*').eq('guardian_id', user.id)),
      rows(admin.from('notifications').select('*').eq('user_id', user.id)),
      rows(admin.from('thread_members').select('thread_id,created_at').eq('user_id', user.id)),
      rows(admin.from('thread_members').select('id,thread_id,user_id,created_at').eq('user_id', user.id)),
      rows(admin.from('messages').select('id,thread_id,sender_id,body,created_at').eq('sender_id', user.id)),
      rows(admin.from('trips').select('*').eq('supervisor_id', user.id)),
      rows(admin.from('incidents').select('*').eq('reported_by', user.id)),
      childIds.length ? rows(admin.from('incidents').select('*').in('child_id', childIds)) : Promise.resolve([]),
      rows(admin.from('audit_log').select('id,school_id,action,entity_type,entity_id,metadata,created_at').eq('actor_id', user.id)),
      rows(admin.from('staff_invitations').select('id,school_id,email,full_name,role,status,expires_at,created_at').eq('invited_by', user.id)),
      rows(admin.from('parent_invitations').select('id,school_id,email,full_name,status,expires_at,created_at').eq('invited_by', user.id)),
      schoolId && profile.role === 'school_admin' ? rows(admin.from('subscriptions').select('id,school_id,plan,status,renews_at,created_at,updated_at').eq('school_id', schoolId)) : Promise.resolve([]),
      schoolId && profile.role === 'school_admin' ? rows(admin.from('app_settings').select('school_id,usd_to_zig_rate,updated_at').eq('school_id', schoolId)) : Promise.resolve([]),
    ]);

    const invoices = ownInvoices;
    const invoiceIds = invoices.map((item) => item.id).filter((id): id is string => typeof id === 'string');
    const paymentRows = invoiceIds.length
      ? await rows(admin.from('payments').select('id,invoice_id,amount,currency,provider,provider_reference,method,idempotency_key,status,paid_at,created_at,updated_at').in('invoice_id', invoiceIds))
      : [];

    const threadIds = ownThreadMembers
      .map((item) => item.thread_id)
      .filter((id): id is string => typeof id === 'string');
    const [threads, threadMessages] = threadIds.length
      ? await Promise.all([
          rows(admin.from('threads').select('id,school_id,created_at,updated_at').in('id', threadIds)),
          rows(admin.from('messages').select('id,thread_id,sender_id,body,created_at').in('thread_id', threadIds)),
        ])
      : [[], []];

    const trips = ownTrips;
    const routeIds = trips.map((item) => item.route_id).filter((id): id is string => typeof id === 'string');
    const [routes, manifests] = routeIds.length
      ? await Promise.all([
          rows(admin.from('routes').select('id,school_id,name,type,polyline,geometry_status,archived_at,created_at,updated_at').in('id', routeIds)),
          rows(admin.from('route_children').select('id,route_id,child_id,stop_id,created_at').in('route_id', routeIds)),
        ])
      : [[], []];
    const stopIds = manifests.map((item) => item.stop_id).filter((id): id is string => typeof id === 'string');
    const stops = stopIds.length
      ? await rows(admin.from('stops').select('id,route_id,name,lat,lng,position,created_at,updated_at').in('id', stopIds))
      : [];
    const tripIds = trips.map((item) => item.id).filter((id): id is string => typeof id === 'string');
    const [liveLocations, locationHistory] = tripIds.length
      ? await Promise.all([
          rows(admin.from('bus_live').select('trip_id,lat,lng,heading,speed,updated_at').in('trip_id', tripIds)),
          rows(admin.from('location_history').select('id,trip_id,lat,lng,speed,recorded_at').in('trip_id', tripIds)),
        ])
      : [[], []];

    const payload = {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      },
      profile,
      school: schoolRows,
      guardianships: guardianRows,
      children,
      authorized_pickups: authorizedPickups,
      trip_events: uniqueById([...guardianEvents, ...recordedEvents]),
      absences: uniqueById([...guardianAbsences, ...reportedAbsences]),
      invoices,
      payments: paymentRows,
      notifications: ownNotifications,
      threads,
      thread_members: ownThreadMembers,
      messages: uniqueById([...authoredMessages, ...threadMessages]),
      trips,
      routes,
      route_children: manifests,
      stops,
      bus_live: liveLocations,
      location_history: locationHistory,
      incidents: uniqueById([...ownIncidents, ...reportedIncidents]),
      audit_log: ownAuditLog,
      staff_invitations: staffInvitations,
      parent_invitations: parentInvitations,
      subscriptions: ownSubscription,
      app_settings: ownSettings,
    };

    console.log(JSON.stringify({
      event: 'data_export_completed',
      user_id: user.id,
      role: profile.role,
      exported_at: payload.exported_at,
    }));

    const filename = `predrive-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    return jsonResponse(payload, 200, {
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'data_export_failed',
      user_id: user.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
    return jsonResponse({ error: 'Unable to export account data. Please try again later.' }, 500);
  }
});
