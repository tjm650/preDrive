import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@predrive/shared';
import { supabase } from '../../lib/supabase';
import {
  enqueueLocation,
  enqueueTripEvent,
  failedEventCount,
  listFailedEvents,
  flushOfflineQueue,
  getActiveTripId,
  pendingEventCount,
  retryFailedEvents,
  setActiveTripId,
  tripEventQueueStatus,
  type FailedTripEvent,
} from '../../lib/offline';

const LOCATION_TASK = 'PREDRIVE_BACKGROUND_TRIP_LOCATION';

type Profile = { id: string; full_name: string; role: UserRole };
type Trip = {
  id: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  route_id: string;
  bus_id: string;
};
type Child = { id: string; first_name: string; class_name: string | null };
type EventRow = { trip_id: string; child_id: string | null; type: string; created_at: string };
type Pickup = { id: string; child_id: string; name: string; relationship: string };
type FamilyNotification = {
  id: string;
  type: string;
  priority: string;
  created_at: string;
  read_at: string | null;
};
type LivePoint = { trip_id: string; lat: number; lng: number; updated_at: string };
type TripCard = Trip & {
  routeName: string;
  routeType: 'pickup' | 'dropoff';
  busName: string;
  children: Child[];
  events: EventRow[];
  location: LivePoint | null;
};

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const asRpc = (client: SupabaseClient) => client as unknown as RpcClient;

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error || !supabase) return;
    const locations =
      (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    const latest = locations[locations.length - 1];
    if (!latest) return;
    const tripId = await getActiveTripId();
    if (!tripId) return;
    await enqueueLocation({
      trip_id: tripId,
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      heading: latest.coords.heading,
      speed: latest.coords.speed === null ? null : latest.coords.speed * 3.6,
      updated_at: new Date(latest.timestamp).toISOString(),
    });
    await flushOfflineQueue(supabase);
  });
}

async function registerPushToken(client: SupabaseClient) {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!client || !projectId) return;
  const permissions = await Notifications.getPermissionsAsync();
  const granted = permissions.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  if (Constants.appOwnership !== 'expo') {
    await Notifications.setNotificationChannelAsync('safety', {
      name: 'Safety alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }
  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await asRpc(client).rpc('register_push_token', { p_token: token.data });
}

export function OperationsDashboard({
  profile,
  onSignOut,
}: {
  profile: Profile;
  onSignOut: () => void;
}) {
  const [cards, setCards] = useState<TripCard[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [familyChildren, setFamilyChildren] = useState<Child[]>([]);
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [queued, setQueued] = useState(0);
  const [failedQueued, setFailedQueued] = useState(0);
  const [failedEvents, setFailedEvents] = useState<FailedTripEvent[]>([]);
  const [pins, setPins] = useState<Record<string, string>>({});
  const [selectedPickups, setSelectedPickups] = useState<Record<string, string>>({});
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const client = supabase;

  const refreshQueue = useCallback(async () => {
    const [pending, failed, rejected] = await Promise.all([
      pendingEventCount(),
      failedEventCount(),
      listFailedEvents(5),
    ]);
    setQueued(pending);
    setFailedQueued(failed);
    setFailedEvents(rejected);
  }, []);

  const load = useCallback(async () => {
    if (!client) {
      setError('Supabase is not configured on this device.');
      setLoading(false);
      return;
    }
    setError(null);
    const tripRows: Trip[] = [];
    let childIds: string[] = [];
    if (profile.role === 'supervisor') {
      const { data, error: tripError } = await client
        .from('trips')
        .select('id,status,started_at,route_id,bus_id')
        .eq('supervisor_id', profile.id)
        .in('status', ['scheduled', 'active'])
        .order('created_at');
      if (tripError) {
        setError(tripError.message);
        setLoading(false);
        return;
      }
      tripRows.push(...((data ?? []) as Trip[]));
    } else if (profile.role === 'parent') {
      const { data: guardianships, error: guardianError } = await client
        .from('guardianships')
        .select('child_id')
        .eq('guardian_id', profile.id);
      if (guardianError) {
        setError(guardianError.message);
        setLoading(false);
        return;
      }
      childIds = (guardianships ?? []).map((item) => item.child_id);
      if (childIds.length) {
        const { data: relations, error: relationError } = await client
          .from('route_children')
          .select('route_id,child_id')
          .in('child_id', childIds);
        if (relationError) {
          setError(relationError.message);
          setLoading(false);
          return;
        }
        const routeIds = [...new Set((relations ?? []).map((item) => item.route_id))];
        if (routeIds.length) {
          const { data, error: tripError } = await client
            .from('trips')
            .select('id,status,started_at,route_id,bus_id')
            .eq('status', 'active')
            .in('route_id', routeIds);
          if (tripError) {
            setError(tripError.message);
            setLoading(false);
            return;
          }
          tripRows.push(...((data ?? []) as Trip[]));
        }
      }
    }
    const routeIds = [...new Set(tripRows.map((trip) => trip.route_id))];
    const busIds = [...new Set(tripRows.map((trip) => trip.bus_id))];
    const tripIds = tripRows.map((trip) => trip.id);
    const [routeRows, busRows, relationRows, eventRows, liveRows] = await Promise.all([
      routeIds.length
        ? client.from('routes').select('id,name,type').in('id', routeIds)
        : Promise.resolve({ data: [], error: null }),
      busIds.length
        ? client.from('buses').select('id,registration').in('id', busIds)
        : Promise.resolve({ data: [], error: null }),
      routeIds.length
        ? client.from('route_children').select('route_id,child_id').in('route_id', routeIds)
        : Promise.resolve({ data: [], error: null }),
      tripIds.length
        ? client
            .from('trip_events')
            .select('trip_id,child_id,type,created_at')
            .in('trip_id', tripIds)
            .order('created_at')
        : Promise.resolve({ data: [], error: null }),
      tripIds.length
        ? client.from('bus_live').select('trip_id,lat,lng,updated_at').in('trip_id', tripIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const allChildIds = [
      ...new Set([...childIds, ...(relationRows.data ?? []).map((row) => row.child_id)]),
    ];
    const [childRows, pickupRows] = await Promise.all([
      allChildIds.length
        ? client.from('children').select('id,first_name,class_name').in('id', allChildIds)
        : Promise.resolve({ data: [], error: null }),
      allChildIds.length
        ? client
            .from('authorized_pickups')
            .select('id,child_id,name,relationship')
            .in('child_id', allChildIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const childList = (childRows.data ?? []) as Child[];
    setFamilyChildren(childList.filter((child) => childIds.includes(child.id)));
    const { data: notificationRows } = await client
      .from('notifications')
      .select('id,type,priority,created_at,read_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setNotifications((notificationRows ?? []) as FamilyNotification[]);
    const eventList = (eventRows.data ?? []) as EventRow[];
    setPickups((pickupRows.data ?? []) as Pickup[]);
    setCards(
      tripRows.map((trip) => ({
        ...trip,
        routeName: routeRows.data?.find((row) => row.id === trip.route_id)?.name ?? 'School route',
        routeType: (routeRows.data?.find((row) => row.id === trip.route_id)?.type ?? 'pickup') as
          'pickup' | 'dropoff',
        busName:
          busRows.data?.find((row) => row.id === trip.bus_id)?.registration ?? 'Assigned vehicle',
        children: childList.filter(
          (child) =>
            (relationRows.data ?? []).some(
              (relation) => relation.route_id === trip.route_id && relation.child_id === child.id,
            ) &&
            (profile.role !== 'parent' || childIds.includes(child.id)),
        ),
        events: eventList.filter(
          (event) =>
            event.trip_id === trip.id &&
            (profile.role !== 'parent' || childIds.includes(event.child_id ?? '')),
        ),
        location:
          ((liveRows.data ?? []) as LivePoint[]).find((point) => point.trip_id === trip.id) ?? null,
      })),
    );
    setLoading(false);
  }, [client, profile.id, profile.role]);

  useEffect(() => {
    void load();
    void refreshQueue();
  }, [load, refreshQueue]);

  useEffect(() => {
    if (!client) return;
    const channel = client
      .channel(`predrive-mobile-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_events' },
        () => void load(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => void load())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bus_live' },
        () => void load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, load, profile.id]);

  useEffect(() => {
    if (!client) return;
    void registerPushToken(client).catch(() =>
      setNotice('Push notifications could not be registered on this build.'),
    );
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? 'preDrive safety update';
      const body = notification.request.content.body;
      setNotice(body ? `${title}: ${body}` : title);
      void load();
    });
    const response = Notifications.addNotificationResponseReceivedListener(() => {
      void load();
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setConnected(online);
      if (online)
        void flushOfflineQueue(client)
          .then(async () => {
            await refreshQueue();
            await load();
          })
          .catch(() => undefined);
    });
    return () => {
      unsubscribe();
      received.remove();
      response.remove();
    };
  }, [client, load, refreshQueue]);

  const activeTrip = useMemo(() => cards.find((trip) => trip.status === 'active') ?? null, [cards]);

  useEffect(() => {
    if (profile.role !== 'supervisor' || !activeTrip || !client) {
      void setActiveTripId(null);
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      void Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
        .then((started) => (started ? Location.stopLocationUpdatesAsync(LOCATION_TASK) : undefined))
        .catch(() => undefined);
      return;
    }
    void setActiveTripId(activeTrip.id);
    let cancelled = false;
    const start = async () => {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!foreground.granted) {
        setNotice('Location permission is required for live vehicle tracking.');
        return;
      }
      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.granted) {
        try {
          const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
          if (!started)
            await Location.startLocationUpdatesAsync(LOCATION_TASK, {
              accuracy: Location.Accuracy.High,
              timeInterval: 15000,
              distanceInterval: 25,
              pausesUpdatesAutomatically: false,
              foregroundService: {
                notificationTitle: 'preDrive trip tracking is active',
                notificationBody:
                  'Your school trip location is being shared with authorised guardians.',
                killServiceOnDestroy: false,
              },
            });
        } catch {
          setNotice('Background tracking could not start. Keep preDrive open during this trip.');
        }
      } else {
        setNotice(
          'Background location permission was not granted. Keep preDrive open during this trip.',
        );
      }
      if (cancelled) return;
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000,
          distanceInterval: 25,
        },
        async (position) => {
          await enqueueLocation({
            trip_id: activeTrip.id,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: position.coords.heading,
            speed: position.coords.speed === null ? null : position.coords.speed * 3.6,
            updated_at: new Date(position.timestamp).toISOString(),
          });
          await flushOfflineQueue(client).catch(() => undefined);
        },
      );
    };
    void start();
    return () => {
      cancelled = true;
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      void setActiveTripId(null);
      void Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
        .then((started) => (started ? Location.stopLocationUpdatesAsync(LOCATION_TASK) : undefined))
        .catch(() => undefined);
    };
  }, [activeTrip?.id, client, profile.role]);

  async function runRpc(name: string, args: Record<string, unknown>) {
    if (!client) throw new Error('Supabase is unavailable.');
    const result = await asRpc(client).rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async function startTrip(tripId: string) {
    setBusy(tripId);
    setError(null);
    try {
      await runRpc('start_trip', { p_trip_id: tripId });
      setNotice('Trip started. Location tracking is being enabled.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start trip.');
    } finally {
      setBusy(null);
    }
  }

  async function recordEvent(
    tripId: string,
    childId: string | null,
    type:
      'boarded' | 'arrived_school' | 'dropped_home' | 'absent' | 'sos' | 'delay' | 'child_missing',
  ) {
    if (!client) return;
    if ((type === 'sos' || type === 'child_missing') && !connected) {
      Alert.alert(
        'No connection',
        'The safety alert has not been sent. Call your school emergency contact immediately, then retry when connectivity returns.',
      );
      return;
    }
    setBusy(`${tripId}:${childId ?? 'trip'}:${type}`);
    setError(null);
    try {
      if (type === 'sos' || type === 'child_missing') {
        await runRpc('record_trip_event', {
          p_trip_id: tripId,
          p_child_id: childId,
          p_type: type,
          p_metadata: { source: 'mobile' },
          p_idempotency_key:
            type === 'child_missing' && childId
              ? `missing-${tripId}-${childId}`
              : `${type}-${Date.now()}`,
        });
        setNotice(
          type === 'sos'
            ? 'SOS event sent to the school and relevant guardians.'
            : 'Missing-child alert sent to the school and the child’s guardians.',
        );
      } else {
        await enqueueTripEvent({ tripId, childId, type });
        const sync = connected
          ? await flushOfflineQueue(client)
          : { syncedEvents: 0, pendingEvents: await pendingEventCount() };
        setNotice(
          sync.pendingEvents
            ? `Saved securely on this device. ${sync.pendingEvents} event(s) are waiting for a connection.`
            : 'Trip event synchronised.',
        );
        await refreshQueue();
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record trip event.');
    } finally {
      setBusy(null);
    }
  }

  async function verifyHandover(tripId: string, childId: string) {
    const pickup = pickups.find(
      (item) => item.id === selectedPickups[childId] && item.child_id === childId,
    );
    const pin = pins[childId] ?? '';
    if (!pickup || pin.length < 4) {
      setError('Select the exact authorised pickup person and enter the PIN.');
      return;
    }
    if (!connected) {
      setError(
        'Pickup PIN verification requires a live connection. Do not release the child while verification is unavailable.',
      );
      return;
    }
    setBusy(`handover-${childId}`);
    setError(null);
    try {
      const data = (await runRpc('verify_pickup_handover', {
        p_trip_id: tripId,
        p_child_id: childId,
        p_pickup_id: pickup.id,
        p_pin: pin,
        p_idempotency_key: `handover-${tripId}-${childId}-${Date.now()}`,
      })) as { verified?: boolean };
      setNotice(
        data.verified
          ? `Handover verified for ${pickup.name}.`
          : 'PIN rejected. The failed handover has been recorded. Do not release the child.',
      );
      setPins((current) => ({ ...current, [childId]: '' }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Handover verification failed.');
    } finally {
      setBusy(null);
    }
  }

  async function completeTrip(tripId: string) {
    const queueStatus = await tripEventQueueStatus(tripId);
    if (queueStatus.pending || queueStatus.failed) {
      setError(
        `This trip has ${queueStatus.pending} unsynchronised and ${queueStatus.failed} rejected event(s). Synchronise or review them before completing the trip.`,
      );
      return;
    }
    setBusy(tripId);
    setError(null);
    try {
      const data = (await runRpc('complete_trip', { p_trip_id: tripId })) as {
        completed?: boolean;
        unaccounted_children?: number;
      };
      if (!data.completed) {
        setError(
          `Trip cannot be closed: ${data.unaccounted_children ?? 'some'} child(ren) are not accounted for. Resolve every manifest entry first.`,
        );
        return;
      }
      setNotice('Trip completed. All manifest children have a final status.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete trip.');
    } finally {
      setBusy(null);
    }
  }

  async function retryFailedQueue() {
    const count = await retryFailedEvents();
    await refreshQueue();
    if (client && connected) {
      const result = await flushOfflineQueue(client);
      await refreshQueue();
      setNotice(
        `${result.syncedEvents} retried event(s) synchronised. ${result.failedEvents} still need review.`,
      );
      await load();
    } else {
      setNotice(`${count} event(s) returned to the offline queue and will retry when connected.`);
    }
  }

  async function signOutSafely() {
    if (client && connected) {
      try {
        await asRpc(client).rpc('register_push_token', { p_token: null });
      } catch {
        // The next account login reassigns this device token atomically.
      }
    }
    onSignOut();
  }

  async function markNotificationRead(notificationId: string) {
    if (!client) return;
    const { error: updateError } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (updateError) setError(updateError.message);
    else await load();
  }

  async function reportAbsence(childId: string) {
    if (!client) return;
    setBusy(childId);
    setError(null);
    const { error: insertError } = await client.from('absences').insert({
      child_id: childId,
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Harare' }).format(new Date()),
      reported_by: profile.id,
    });
    if (insertError)
      setError(
        insertError.code === '23505'
          ? 'An absence is already recorded for today.'
          : insertError.message,
      );
    else setNotice('Absence reported to the school.');
    setBusy(null);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PREDRIVE · ZIMBABWE</Text>
          <Text style={styles.heading}>Good day, {profile.full_name.split(' ')[0]}.</Text>
          <Text style={styles.subtitle}>{profile.role.replace('_', ' ')} workspace</Text>
        </View>
        <Pressable onPress={() => void signOutSafely()} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.connection}>
        <View style={[styles.dot, { backgroundColor: connected ? '#16A36A' : '#D97706' }]} />
        <Text style={styles.connectionText}>
          {connected
            ? 'Connected · Live updates enabled'
            : 'Offline · Events will queue on this device'}
        </Text>
        {queued > 0 ? <Text style={styles.queueText}>{queued} queued</Text> : null}
      </View>
      {failedQueued > 0 ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>
            {failedQueued} offline event(s) were rejected by the server and need review. They have
            been preserved on this device.
          </Text>
          {failedEvents.map((event) => (
            <View key={event.id} style={styles.notificationRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{event.event_type.replaceAll('_', ' ')}</Text>
                <Text style={styles.muted}>
                  {new Date(event.client_recorded_at).toLocaleString()}
                </Text>
                <Text style={styles.errorText}>{event.failure_reason}</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={() => void retryFailedQueue()} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>Retry rejected events</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityRole="status" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {notifications.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety notifications</Text>
          {notifications.map((item) => (
            <View key={item.id} style={styles.notificationRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{item.type.replaceAll('_', ' ')}</Text>
                <Text style={styles.muted}>
                  {item.priority.toUpperCase()} · {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
              {!item.read_at ? (
                <Pressable
                  onPress={() => void markNotificationRead(item.id)}
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>Mark read</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {loading ? <ActivityIndicator color="#0B8067" style={{ marginTop: 32 }} /> : null}
      {!loading && profile.role === 'parent' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your children's journeys</Text>
          {familyChildren.map((child) => (
            <View key={child.id} style={styles.childLine}>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{child.first_name}</Text>
                <Text style={styles.muted}>{child.class_name ?? 'Class not assigned'}</Text>
              </View>
              <Pressable onPress={() => void reportAbsence(child.id)} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Report absent</Text>
              </Pressable>
            </View>
          ))}
          {cards.length === 0 ? (
            <Text style={styles.muted}>
              No active journey is currently available for your children.
            </Text>
          ) : (
            cards.map((trip) => (
              <View key={trip.id} style={styles.card}>
                <Text style={styles.cardTitle}>{trip.routeName}</Text>
                <Text style={styles.muted}>{trip.busName} · Live trip</Text>
                {trip.children.map((child) => {
                  const latest = trip.events
                    .filter((event) => event.child_id === child.id)
                    .slice(-1)[0];
                  return (
                    <View key={child.id} style={styles.childLine}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.childName}>{child.first_name}</Text>
                        <Text style={styles.muted}>
                          {latest ? latest.type.replaceAll('_', ' ') : 'Waiting for first update'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void reportAbsence(child.id)}
                        style={styles.smallButton}
                      >
                        <Text style={styles.smallButtonText}>Report absent</Text>
                      </Pressable>
                    </View>
                  );
                })}
                {trip.location ? (
                  <Text style={styles.locationText}>
                    Last location: {trip.location.lat.toFixed(5)}, {trip.location.lng.toFixed(5)} ·{' '}
                    {new Date(trip.location.updated_at).toLocaleTimeString()}
                  </Text>
                ) : (
                  <Text style={styles.muted}>Waiting for the vehicle's first location update.</Text>
                )}
              </View>
            ))
          )}
        </View>
      ) : null}
      {!loading && profile.role === 'supervisor' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned trips</Text>
          {cards.length === 0 ? (
            <Text style={styles.muted}>No scheduled or active trips assigned to you.</Text>
          ) : (
            cards.map((trip) => (
              <View key={trip.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{trip.routeName}</Text>
                    <Text style={styles.muted}>
                      {trip.busName} · {trip.status}
                    </Text>
                  </View>
                  {trip.status === 'scheduled' ? (
                    <Pressable
                      disabled={busy === trip.id}
                      onPress={() => void startTrip(trip.id)}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryText}>
                        {busy === trip.id ? 'Starting…' : 'Start trip'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {trip.status === 'active' ? (
                  <>
                    {trip.children.map((child) => {
                      const events = trip.events.filter((event) => event.child_id === child.id);
                      const latest = events.slice(-1)[0];
                      const hasBoarded = events.some((event) => event.type === 'boarded');
                      const hasHandover = events.some(
                        (event) => event.type === 'handover_verified',
                      );
                      const finalStatus = events.some((event) =>
                        ['dropped_home', 'absent', 'arrived_school'].includes(event.type),
                      );
                      const childPickups = pickups.filter((pickup) => pickup.child_id === child.id);
                      return (
                        <View key={child.id} style={styles.manifestChild}>
                          <View>
                            <Text style={styles.childName}>{child.first_name}</Text>
                            <Text style={styles.muted}>
                              {latest?.type.replaceAll('_', ' ') ?? 'Not yet recorded'}
                            </Text>
                          </View>
                          {!finalStatus ? (
                            <View style={styles.actionGrid}>
                              {!hasBoarded ? (
                                <>
                                  <Action
                                    label="Boarded"
                                    onPress={() => void recordEvent(trip.id, child.id, 'boarded')}
                                  />
                                  <Action
                                    label="Absent"
                                    onPress={() => void recordEvent(trip.id, child.id, 'absent')}
                                  />
                                </>
                              ) : (
                                <>
                                  {trip.routeType === 'pickup' ? (
                                    <Action
                                      label="At school"
                                      onPress={() =>
                                        void recordEvent(trip.id, child.id, 'arrived_school')
                                      }
                                    />
                                  ) : hasHandover ? (
                                    <Action
                                      label="Dropped home"
                                      onPress={() =>
                                        void recordEvent(trip.id, child.id, 'dropped_home')
                                      }
                                    />
                                  ) : null}
                                </>
                              )}
                              {events.some((event) => event.type === 'child_missing') ? (
                                <Text style={styles.finalLabel}>Missing-child alert sent</Text>
                              ) : (
                                <Action
                                  label="Missing child"
                                  onPress={() =>
                                    void recordEvent(trip.id, child.id, 'child_missing')
                                  }
                                />
                              )}
                            </View>
                          ) : (
                            <Text style={styles.finalLabel}>Final status recorded</Text>
                          )}
                          {trip.routeType === 'dropoff' &&
                          hasBoarded &&
                          !hasHandover &&
                          !finalStatus ? (
                            <View style={styles.handover}>
                              {childPickups.length > 0 ? (
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={{ gap: 6 }}
                                >
                                  {childPickups.map((pickup) => (
                                    <Pressable
                                      key={pickup.id}
                                      onPress={() =>
                                        setSelectedPickups((current) => ({
                                          ...current,
                                          [child.id]: pickup.id,
                                        }))
                                      }
                                      style={[
                                        styles.pickupChoice,
                                        selectedPickups[child.id] === pickup.id &&
                                          styles.pickupSelected,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.pickupChoiceText,
                                          selectedPickups[child.id] === pickup.id &&
                                            styles.pickupSelectedText,
                                        ]}
                                      >
                                        {pickup.name}
                                      </Text>
                                    </Pressable>
                                  ))}
                                </ScrollView>
                              ) : (
                                <Text style={styles.muted}>
                                  No authorised pickup person is registered. Do not release this
                                  child.
                                </Text>
                              )}
                              {childPickups.length > 0 ? (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TextInput
                                    value={pins[child.id] ?? ''}
                                    onChangeText={(value) =>
                                      setPins((current) => ({ ...current, [child.id]: value }))
                                    }
                                    secureTextEntry
                                    keyboardType="number-pad"
                                    placeholder="Pickup PIN"
                                    style={styles.pinInput}
                                  />
                                  <Pressable
                                    onPress={() => void verifyHandover(trip.id, child.id)}
                                    style={styles.smallButton}
                                  >
                                    <Text style={styles.smallButtonText}>Verify</Text>
                                  </Pressable>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    <View style={styles.tripActions}>
                      <Pressable
                        onPress={() => void recordEvent(trip.id, null, 'sos')}
                        style={styles.sosButton}
                      >
                        <Text style={styles.sosText}>SOS emergency</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void completeTrip(trip.id)}
                        style={styles.completeButton}
                      >
                        <Text style={styles.completeText}>Complete trip</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}
      {!loading && profile.role === 'school_admin' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School administration</Text>
          <Text style={styles.muted}>
            Use the web operations workspace to manage children, fleet, routes, staff and invoices.
            Trip status and incident updates will appear in this mobile app.
          </Text>
        </View>
      ) : null}
      {!loading && profile.role === 'platform_owner' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform oversight</Text>
          <Text style={styles.muted}>
            Platform-wide administration is available through the web console. This mobile account
            is read-only.
          </Text>
        </View>
      ) : null}
      <Text style={styles.footer}>
        Child safety takes priority. If a safety check cannot be completed, do not release the
        child.
      </Text>
    </ScrollView>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionButton}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8F7' },
  content: {
    padding: 22,
    paddingTop: 18,
    paddingBottom: 48,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  eyebrow: { color: '#0B8067', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  heading: { color: '#112F28', fontSize: 28, fontWeight: '900', letterSpacing: -1, marginTop: 7 },
  subtitle: { color: '#71827c', fontSize: 13, marginTop: 5, textTransform: 'capitalize' },
  signOut: {
    borderWidth: 1,
    borderColor: '#d6e3dd',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  signOutText: { color: '#34594D', fontSize: 12, fontWeight: '800' },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E4ECE8',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connectionText: { color: '#58746A', fontSize: 11, flex: 1 },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: '#E4ECE8',
  },
  queueText: { color: '#B45309', fontSize: 11, fontWeight: '800' },
  error: {
    color: '#B42318',
    backgroundColor: '#FEF3F2',
    padding: 13,
    borderRadius: 12,
    marginTop: 14,
    fontSize: 12,
  },
  errorPanel: { backgroundColor: '#FEF3F2', padding: 13, borderRadius: 12, marginTop: 14, gap: 8 },
  errorText: { color: '#B42318', fontSize: 12 },
  notice: {
    color: '#17664F',
    backgroundColor: '#E8F4EE',
    padding: 13,
    borderRadius: 12,
    marginTop: 14,
    fontSize: 12,
  },
  section: { marginTop: 28 },
  sectionTitle: { color: '#15362E', fontSize: 19, fontWeight: '900', marginBottom: 13 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4ECE8',
    borderRadius: 18,
    padding: 17,
    marginBottom: 13,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { color: '#183B31', fontSize: 16, fontWeight: '900' },
  muted: { color: '#71827c', fontSize: 12, marginTop: 5 },
  childLine: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EDF2EF',
    paddingVertical: 12,
    marginTop: 10,
    gap: 10,
  },
  childName: { color: '#21483C', fontSize: 13, fontWeight: '800' },
  smallButton: {
    borderWidth: 1,
    borderColor: '#D6E3DD',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonText: { color: '#315E50', fontSize: 10, fontWeight: '800' },
  locationText: { color: '#71827c', fontSize: 10, marginTop: 12 },
  primaryButton: {
    backgroundColor: '#0B6B58',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  manifestChild: { borderTopWidth: 1, borderTopColor: '#EDF2EF', paddingTop: 14, marginTop: 13 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  actionButton: {
    backgroundColor: '#EDF5F1',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  actionText: { color: '#28624F', fontSize: 10, fontWeight: '800' },
  finalLabel: { color: '#16815F', fontSize: 10, fontWeight: '800', marginTop: 9 },
  handover: { gap: 8, marginTop: 10 },
  pickupChoice: {
    borderWidth: 1,
    borderColor: '#D6E3DD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pickupSelected: { backgroundColor: '#0B6B58', borderColor: '#0B6B58' },
  pickupChoiceText: { color: '#315E50', fontSize: 10, fontWeight: '700' },
  pickupSelectedText: { color: '#FFFFFF' },
  pinInput: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCE7E2',
    paddingHorizontal: 10,
    color: '#17382F',
    fontSize: 12,
  },
  tripActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  sosButton: {
    flex: 1,
    backgroundColor: '#B42318',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  sosText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  completeButton: {
    flex: 1,
    backgroundColor: '#0B6B58',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  completeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  footer: { marginTop: 30, color: '#91A19A', fontSize: 10, lineHeight: 16, textAlign: 'center' },
});
