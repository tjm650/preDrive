import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const routingKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
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

type Stop = { id: string; name: string; lat: number; lng: number; position: number };
type RouteResponse = {
  features?: Array<{
    geometry?: { type?: string; coordinates?: number[][] };
    properties?: { summary?: { distance?: number; duration?: number } };
  }>;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return textResponse('Method not allowed', 405);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return textResponse('Unauthorized', 401);
  const { data: auth, error: authError } = await authClient.auth.getUser(token);
  if (authError || !auth.user) return textResponse('Unauthorized', 401);
  if (!routingKey)
    return jsonResponse(
      {
        error:
          'Road routing is not configured. Add OPENROUTESERVICE_API_KEY to Supabase function secrets.',
      },
      503,
    );

  const body = (await request.json().catch(() => null)) as { route_id?: string } | null;
  if (!body?.route_id) return jsonResponse({ error: 'route_id is required.' }, 400);

  const { data: profile } = await admin
    .from('profiles')
    .select('school_id,role')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'school_admin' || !profile.school_id)
    return textResponse('Forbidden', 403);

  const { data: route, error: routeError } = await admin
    .from('routes')
    .select('id,school_id,name')
    .eq('id', body.route_id)
    .eq('school_id', profile.school_id)
    .maybeSingle();
  if (routeError || !route) return jsonResponse({ error: 'Route not found in your school.' }, 404);

  const { data: stops, error: stopsError } = await admin
    .from('stops')
    .select('id,name,lat,lng,position')
    .eq('route_id', route.id)
    .order('position');
  if (stopsError) return jsonResponse({ error: 'Unable to load route stops.' }, 500);
  const orderedStops = (stops ?? []) as Stop[];
  if (orderedStops.length < 2 || orderedStops.length > 50) {
    return jsonResponse(
      { error: 'A route needs between 2 and 50 ordered stops before road routing.' },
      422,
    );
  }

  const coordinates = orderedStops.map((stop) => [stop.lng, stop.lat]);
  const response = await fetch(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    {
      method: 'POST',
      headers: {
        authorization: routingKey,
        'content-type': 'application/json',
        accept: 'application/geo+json',
      },
      body: JSON.stringify({ coordinates, instructions: false, geometry_simplify: false }),
    },
  );
  if (!response.ok) {
    const details = await response.text();
    return jsonResponse(
      {
        error: 'Road routing provider could not calculate this route.',
        provider_status: response.status,
        details: details.slice(0, 500),
      },
      502,
    );
  }

  const result = (await response.json()) as RouteResponse;
  const feature = result.features?.[0];
  const points = feature?.geometry?.coordinates;
  const distance = feature?.properties?.summary?.distance;
  const duration = feature?.properties?.summary?.duration;
  if (
    feature?.geometry?.type !== 'LineString' ||
    !points ||
    points.length < 2 ||
    typeof distance !== 'number' ||
    !Number.isFinite(distance) ||
    typeof duration !== 'number' ||
    !Number.isFinite(duration)
  ) {
    return jsonResponse({ error: 'Routing provider returned incomplete road geometry.' }, 502);
  }
  if (
    points.some(
      (point) =>
        point.length < 2 ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1]) ||
        point[0] < -180 ||
        point[0] > 180 ||
        point[1] < -90 ||
        point[1] > 90,
    )
  ) {
    return jsonResponse({ error: 'Routing provider returned invalid coordinates.' }, 502);
  }

  const verifiedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from('routes')
    .update({
      polyline: points,
      geometry_source: 'openrouteservice',
      geometry_status: 'provider_verified',
      geometry_verified_at: verifiedAt,
      distance_m: Math.round(distance),
      duration_s: Math.round(duration),
    })
    .eq('id', route.id)
    .eq('school_id', profile.school_id);
  if (updateError) return jsonResponse({ error: 'Road geometry could not be saved.' }, 500);

  await admin.from('audit_log').insert({
    school_id: profile.school_id,
    actor_id: auth.user.id,
    action: 'route_geometry_provider_verified',
    entity_type: 'route',
    entity_id: route.id,
    metadata: {
      provider: 'openrouteservice',
      stop_count: orderedStops.length,
      point_count: points.length,
      distance_m: Math.round(distance),
      duration_s: Math.round(duration),
    },
  });
  return jsonResponse({
    verified: true,
    provider: 'openrouteservice',
    route_id: route.id,
    distance_m: Math.round(distance),
    duration_s: Math.round(duration),
    stop_count: orderedStops.length,
    geometry_points: points.length,
    verified_at: verifiedAt,
    note: 'Provider-calculated road geometry. A school operator must still field-check stop access and child pickup/drop-off safety.',
  });
});
