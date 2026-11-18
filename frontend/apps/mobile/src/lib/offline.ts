import * as SQLite from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TripEventKind =
  | 'boarded'
  | 'arrived_school'
  | 'dropped_home'
  | 'absent'
  | 'sos'
  | 'delay'
  | 'child_missing';

export type QueuedTripEvent = {
  id: number;
  trip_id: string;
  child_id: string | null;
  event_type: TripEventKind;
  lat: number | null;
  lng: number | null;
  metadata: string;
  idempotency_key: string;
  client_recorded_at: string;
};

type QueuedLocation = {
  trip_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  databasePromise ??= SQLite.openDatabaseAsync('predrive-offline.db');
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pending_trip_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      child_id TEXT,
      event_type TEXT NOT NULL,
      lat REAL,
      lng REAL,
      metadata TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      client_recorded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pending_locations (
      trip_id TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      heading REAL,
      speed REAL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function makeIdempotencyKey() {
  return `pd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function enqueueTripEvent(input: {
  tripId: string;
  childId: string | null;
  type: TripEventKind;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const db = await database();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO pending_trip_events
      (trip_id,child_id,event_type,lat,lng,metadata,idempotency_key,client_recorded_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    input.tripId,
    input.childId,
    input.type,
    input.latitude ?? null,
    input.longitude ?? null,
    JSON.stringify(input.metadata ?? {}),
    makeIdempotencyKey(),
    createdAt,
  );
}

export async function enqueueLocation(input: QueuedLocation) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO pending_locations (trip_id,lat,lng,heading,speed,updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(trip_id) DO UPDATE SET
       lat=excluded.lat,lng=excluded.lng,heading=excluded.heading,
       speed=excluded.speed,updated_at=excluded.updated_at`,
    input.trip_id,
    input.lat,
    input.lng,
    input.heading,
    input.speed,
    input.updated_at,
  );
}

export async function pendingEventCount() {
  const db = await database();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM pending_trip_events',
  );
  return row?.count ?? 0;
}

export async function flushOfflineQueue(client: SupabaseClient) {
  const db = await database();
  const rpc = client.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  const events = await db.getAllAsync<QueuedTripEvent>(
    'SELECT * FROM pending_trip_events ORDER BY id ASC LIMIT 100',
  );
  let syncedEvents = 0;
  for (const event of events) {
    const { error } = await rpc('record_trip_event', {
      p_trip_id: event.trip_id,
      p_child_id: event.child_id,
      p_type: event.event_type,
      p_lat: event.lat,
      p_lng: event.lng,
      p_metadata: JSON.parse(event.metadata) as Record<string, unknown>,
      p_idempotency_key: event.idempotency_key,
      p_client_recorded_at: event.client_recorded_at,
    });
    if (error) break;
    await db.runAsync('DELETE FROM pending_trip_events WHERE id = ?', event.id);
    syncedEvents += 1;
  }

  const locations = await db.getAllAsync<QueuedLocation>('SELECT * FROM pending_locations');
  let syncedLocations = 0;
  const upsert = client.from as unknown as (
    table: string,
  ) => { upsert: (values: QueuedLocation, options: { onConflict: string }) => Promise<{ error: { message: string } | null }> };
  for (const location of locations) {
    const { error } = await upsert('bus_live').upsert(location, { onConflict: 'trip_id' });
    if (error) continue;
    await db.runAsync('DELETE FROM pending_locations WHERE trip_id = ?', location.trip_id);
    syncedLocations += 1;
  }
  return { syncedEvents, syncedLocations, pendingEvents: await pendingEventCount() };
}

export async function setActiveTripId(tripId: string | null) {
  const db = await database();
  if (tripId) await db.runAsync('INSERT OR REPLACE INTO app_state (key,value) VALUES (?,?)', 'active_trip_id', tripId);
  else await db.runAsync("DELETE FROM app_state WHERE key = 'active_trip_id'");
}

export async function getActiveTripId() {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_state WHERE key = 'active_trip_id'",
  );
  return row?.value ?? null;
}
