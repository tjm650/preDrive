'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

type Tab = 'children' | 'fleet' | 'routes' | 'trips' | 'billing' | 'staff';
type Child = {
  id: string;
  first_name: string;
  class_name: string | null;
  archived_at: string | null;
};
type Bus = {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
  capacity: number;
  active: boolean;
  archived_at: string | null;
};
type Route = {
  id: string;
  name: string;
  type: 'pickup' | 'dropoff';
  archived_at: string | null;
  geometry_status?: string;
  distance_m?: number | null;
  duration_s?: number | null;
};
type Stop = {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
};
type RouteAssignment = { id: string; route_id: string; child_id: string };
type TripRecord = {
  id: string;
  status: string;
  route_id: string;
  bus_id: string;
  supervisor_id: string;
  started_at: string | null;
};
type Invoice = {
  id: string;
  amount_usd: number;
  currency: string;
  status: string;
  due_date: string;
  guardian_id: string | null;
};
type Guardian = { id: string; full_name: string; role: string };
type Staff = { id: string; full_name: string; role: string };

const tabs: { id: Tab; label: string }[] = [
  { id: 'children', label: 'Children' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'routes', label: 'Routes' },
  { id: 'trips', label: 'Trips' },
  { id: 'billing', label: 'Billing' },
  { id: 'staff', label: 'Staff' },
];

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('children');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [routeAssignments, setRouteAssignments] = useState<RouteAssignment[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [childGuardian, setChildGuardian] = useState('');
  const [busRegistration, setBusRegistration] = useState('');
  const [busMake, setBusMake] = useState('');
  const [busModel, setBusModel] = useState('');
  const [busCapacity, setBusCapacity] = useState('16');
  const [routeName, setRouteName] = useState('');
  const [routeType, setRouteType] = useState<'pickup' | 'dropoff'>('pickup');
  const [tripRoute, setTripRoute] = useState('');
  const [tripBus, setTripBus] = useState('');
  const [tripSupervisor, setTripSupervisor] = useState('');
  const [invoiceGuardian, setInvoiceGuardian] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDue, setInvoiceDue] = useState('');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'supervisor' | 'school_admin'>('supervisor');

  const load = useCallback(async () => {
    const client = createClient();
    if (!client) {
      setError('Configure the Supabase URL and publishable key to use school operations.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) {
      window.location.assign('/login');
      return;
    }
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('school_id,role')
      .eq('id', auth.user.id)
      .single();
    if (profileError || !profile?.school_id || profile.role !== 'school_admin') {
      setError('This workspace is available to school administrators only.');
      setLoading(false);
      return;
    }
    setSchoolId(profile.school_id);
    const [childRows, busRows, routeRows, invoiceRows, guardianRows, staffRows, stopRows] =
      await Promise.all([
        client.from('children').select('*').eq('school_id', profile.school_id).order('first_name'),
        client.from('buses').select('*').eq('school_id', profile.school_id).order('registration'),
        client.from('routes').select('*').eq('school_id', profile.school_id).order('name'),
        client
          .from('invoices')
          .select('*')
          .eq('school_id', profile.school_id)
          .order('due_date', { ascending: false }),
        client
          .from('profiles')
          .select('id,full_name,role')
          .eq('school_id', profile.school_id)
          .eq('role', 'parent')
          .order('full_name'),
        client
          .from('profiles')
          .select('id,full_name,role')
          .eq('school_id', profile.school_id)
          .in('role', ['supervisor', 'school_admin'])
          .order('full_name'),
        client.from('stops').select('*').order('position'),
      ]);
    if (
      childRows.error ||
      busRows.error ||
      routeRows.error ||
      invoiceRows.error ||
      guardianRows.error ||
      staffRows.error ||
      stopRows.error
    ) {
      setError('Some records could not be loaded. Check the school permissions and retry.');
    }
    setChildren(((childRows.data ?? []) as unknown as Child[]).filter((row) => !row.archived_at));
    setBuses(((busRows.data ?? []) as unknown as Bus[]).filter((row) => !row.archived_at));
    setRoutes(((routeRows.data ?? []) as unknown as Route[]).filter((row) => !row.archived_at));
    setStops((stopRows.data ?? []) as Stop[]);
    const routeIds = (routeRows.data ?? []).map((row) => row.id);
    const [assignmentRows, tripRows] = await Promise.all([
      routeIds.length
        ? client.from('route_children').select('id,route_id,child_id').in('route_id', routeIds)
        : Promise.resolve({ data: [], error: null }),
      routeIds.length
        ? client
            .from('trips')
            .select('id,status,route_id,bus_id,supervisor_id,started_at')
            .in('route_id', routeIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (assignmentRows.error || tripRows.error)
      setError('Route assignments or trip schedules could not be loaded.');
    setRouteAssignments((assignmentRows.data ?? []) as RouteAssignment[]);
    setTrips((tripRows.data ?? []) as TripRecord[]);
    setInvoices((invoiceRows.data ?? []) as unknown as Invoice[]);
    setGuardians((guardianRows.data ?? []) as Guardian[]);
    setStaff((staffRows.data ?? []) as Staff[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, action: () => Promise<void>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice('Changes saved.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function createChild(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !schoolId) throw new Error('School session is unavailable.');
      if (!childGuardian) throw new Error('Choose the parent account responsible for this child.');
      const rpc = client.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
      const { error: enrolmentError } = await rpc('create_child_with_guardian', {
        p_first_name: childName.trim(),
        p_class_name: childClass.trim() || null,
        p_guardian_id: childGuardian,
        p_relationship: 'Parent',
      });
      if (enrolmentError) throw enrolmentError;
      setChildName('');
      setChildClass('');
      setChildGuardian('');
    });
  }

  async function createBus(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !schoolId) throw new Error('School session is unavailable.');
      const capacity = Number(busCapacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)
        throw new Error('Enter a valid bus capacity.');
      const { error: insertError } = await client.from('buses').insert({
        school_id: schoolId,
        registration: busRegistration.trim().toUpperCase(),
        make: busMake.trim() || null,
        model: busModel.trim() || null,
        capacity,
      });
      if (insertError) throw insertError;
      setBusRegistration('');
      setBusMake('');
      setBusModel('');
    });
  }

  async function createRoute(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !schoolId) throw new Error('School session is unavailable.');
      const { error: insertError } = await client.from('routes').insert({
        school_id: schoolId,
        name: routeName.trim(),
        type: routeType,
      });
      if (insertError) throw insertError;
      setRouteName('');
    });
  }

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !tripRoute || !tripBus || !tripSupervisor)
        throw new Error('Select a field-checked route, active vehicle and supervisor.');
      const route = routes.find((item) => item.id === tripRoute);
      const bus = buses.find((item) => item.id === tripBus);
      if (route?.geometry_status !== 'manually_verified')
        throw new Error('Trips can only be scheduled on field-checked road routes.');
      if (!bus?.active || bus.archived_at) throw new Error('Select an active vehicle.');
      if (!routeAssignments.some((assignment) => assignment.route_id === tripRoute))
        throw new Error('Assign at least one child to the route before scheduling a trip.');
      const { error: insertError } = await client
        .from('trips')
        .insert({
          route_id: tripRoute,
          bus_id: tripBus,
          supervisor_id: tripSupervisor,
          status: 'scheduled',
        });
      if (insertError) throw insertError;
    });
  }

  async function inviteStaff(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client) throw new Error('School session is unavailable.');
      const { error: inviteError } = await client.functions.invoke('invite-staff', {
        body: { email: staffEmail.trim(), full_name: staffName.trim(), role: staffRole },
      });
      if (inviteError) throw inviteError;
      setStaffEmail('');
      setStaffName('');
    });
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !schoolId) throw new Error('School session is unavailable.');
      const amount = Number(invoiceAmount);
      if (!invoiceGuardian || !Number.isFinite(amount) || amount <= 0 || !invoiceDue) {
        throw new Error('Choose a parent, enter a positive amount and set a due date.');
      }
      const { error: insertError } = await client.from('invoices').insert({
        school_id: schoolId,
        guardian_id: invoiceGuardian,
        amount_usd: amount,
        currency: 'USD',
        status: 'pending',
        due_date: invoiceDue,
      });
      if (insertError) throw insertError;
      setInvoiceAmount('');
      setInvoiceDue('');
    });
  }

  async function recordManualPayment(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      const amount = Number(paymentAmount);
      if (!client || !paymentInvoiceId || !Number.isFinite(amount) || amount <= 0 || !paymentReference.trim()) {
        throw new Error('Choose an invoice and enter a positive amount and receipt reference.');
      }
      const rpc = client.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
      const { error: paymentError } = await rpc('record_manual_payment', {
        p_invoice_id: paymentInvoiceId,
        p_amount: amount,
        p_currency: invoices.find((invoice) => invoice.id === paymentInvoiceId)?.currency ?? 'USD',
        p_reference: paymentReference.trim(),
      });
      if (paymentError) throw paymentError;
      setPaymentInvoiceId('');
      setPaymentAmount('');
      setPaymentReference('');
    });
  }

  async function archiveChild(id: string) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client
      .from('children')
      .update({ archived_at: new Date().toISOString() } as never)
      .eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  }
  async function archiveBus(id: string) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client
      .from('buses')
      .update({ archived_at: new Date().toISOString(), active: false } as never)
      .eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  }
  async function addStop(routeId: string, name: string, lat: number, lng: number) {
    const client = createClient();
    if (!client) return;
    const position =
      stops
        .filter((stop) => stop.route_id === routeId)
        .reduce((max, stop) => Math.max(max, stop.position), -1) + 1;
    const { error: insertError } = await client
      .from('stops')
      .insert({ route_id: routeId, name: name.trim(), lat, lng, position });
    if (insertError) setError(insertError.message);
    else await load();
  }
  async function attestRouteFieldCheck(routeId: string) {
    const client = createClient();
    if (!client) return;
    if (
      !window.confirm(
        'Confirm that a school representative has physically checked every stop, safe boarding point and the provider-calculated road route?',
      )
    )
      return;
    const { error: rpcError } = await client.rpc('verify_route_field_check', {
      p_route_id: routeId,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNotice('Route field check recorded. Supervisors can now start trips on this route.');
    await load();
  }
  async function assignChild(routeId: string, childId: string) {
    const client = createClient();
    if (!client) return;
    const { error: insertError } = await client
      .from('route_children')
      .insert({ route_id: routeId, child_id: childId });
    if (insertError) setError(insertError.message);
    else await load();
  }
  async function removeRouteChild(assignmentId: string) {
    const client = createClient();
    if (!client) return;
    const { error: deleteError } = await client
      .from('route_children')
      .delete()
      .eq('id', assignmentId);
    if (deleteError) setError(deleteError.message);
    else await load();
  }
  async function buildRouteGeometry(routeId: string) {
    const client = createClient();
    if (!client) return;
    setError(null);
    setNotice(null);
    const { data, error: functionError } = await client.functions.invoke('build-route-geometry', {
      body: { route_id: routeId },
    });
    if (functionError) {
      setError(functionError.message);
      return;
    }
    const result = data as {
      verified?: boolean;
      distance_m?: number;
      duration_s?: number;
      note?: string;
      error?: string;
    };
    if (!result.verified) {
      setError(result.error ?? 'Road routing was not verified.');
      return;
    }
    setNotice(
      `Road geometry provider-verified: ${(result.distance_m ?? 0).toLocaleString()} m, ${Math.round((result.duration_s ?? 0) / 60)} min. ${result.note ?? ''}`,
    );
    await load();
  }
  async function archiveRoute(id: string) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client
      .from('routes')
      .update({ archived_at: new Date().toISOString() } as never)
      .eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  }

  async function renameChild(id: string, name: string) {
    const client = createClient();
    if (!client || !name.trim()) return;
    const { error: updateError } = await client
      .from('children')
      .update({ first_name: name.trim() })
      .eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  }
  async function toggleBus(bus: Bus) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client
      .from('buses')
      .update({ active: !bus.active })
      .eq('id', bus.id);
    if (updateError) setError(updateError.message);
    else await load();
  }
  async function renameRoute(id: string, name: string) {
    const client = createClient();
    if (!client || !name.trim()) return;
    const { error: updateError } = await client
      .from('routes')
      .update({ name: name.trim() })
      .eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  }
  async function voidInvoice(id: string) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client
      .from('invoices')
      .update({ status: 'void' })
      .eq('id', id)
      .eq('status', 'pending');
    if (updateError) setError(updateError.message);
    else await load();
  }

  return (
    <main className="min-h-screen bg-[#f5f8f7] px-5 py-8 text-[#17382f] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/dashboard" className="text-sm font-bold text-[#0b8067]">
              ← Dashboard
            </a>
            <h1 className="mt-3 text-3xl font-black">School operations</h1>
            <p className="mt-1 text-sm text-[#71827c]">
              Manage records within your school workspace.
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-full border border-[#d6e3dd] bg-white px-4 py-2 text-xs font-bold">
              Sign out
            </button>
          </form>
        </div>
        <div className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-[#e3ece7] bg-white p-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === item.id ? 'bg-[#0b6b58] text-white' : 'text-[#60756d] hover:bg-[#f0f5f2]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-8 text-sm text-[#71827c]">Loading school records…</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-[#e3ece7] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-extrabold">
                {tab === 'children'
                  ? 'Registered children'
                  : tab === 'fleet'
                    ? 'School fleet'
                    : tab === 'routes'
                      ? 'Transport routes'
                      : tab === 'trips'
                        ? 'Trip schedule'
                        : tab === 'billing'
                          ? 'Invoices'
                          : 'School staff'}
              </h2>
              {tab === 'children' ? (
                <div className="mt-5 divide-y divide-[#edf2ef]">
                  {children.map((child) => (
                    <ChildRow
                      key={child.id}
                      child={child}
                      onSave={renameChild}
                      onArchive={archiveChild}
                    />
                  ))}
                  {children.length === 0 ? <Empty>No children registered yet.</Empty> : null}
                </div>
              ) : null}
              {tab === 'fleet' ? (
                <div className="mt-5 divide-y divide-[#edf2ef]">
                  {buses.map((bus) => (
                    <div key={bus.id} className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <p className="font-bold">{bus.registration}</p>
                        <p className="mt-1 text-xs text-[#71827c]">
                          {[bus.make, bus.model].filter(Boolean).join(' ') || 'Vehicle'} · Capacity{' '}
                          {bus.capacity}
                        </p>
                        <p className="mt-1 text-xs">{bus.active ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void toggleBus(bus)}
                          className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold"
                        >
                          {bus.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => void archiveBus(bus.id)}
                          className="rounded-lg border border-[#f1d2ce] px-3 py-2 text-xs font-bold text-red-700"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  ))}
                  {buses.length === 0 ? <Empty>No vehicles registered yet.</Empty> : null}
                </div>
              ) : null}
              {tab === 'routes' ? (
                <div className="mt-5 divide-y divide-[#edf2ef]">
                  {routes.map((route) => (
                    <RouteRow
                      key={route.id}
                      route={route}
                      stops={stops.filter((stop) => stop.route_id === route.id)}
                      childOptions={children}
                      assignments={routeAssignments.filter(
                        (assignment) => assignment.route_id === route.id,
                      )}
                      onSave={renameRoute}
                      onArchive={archiveRoute}
                      onAddStop={addStop}
                      onBuildGeometry={buildRouteGeometry}
                      onFieldCheck={attestRouteFieldCheck}
                      onAssignChild={assignChild}
                      onRemoveChild={removeRouteChild}
                    />
                  ))}
                  {routes.length === 0 ? <Empty>No routes configured yet.</Empty> : null}
                </div>
              ) : null}
              {tab === 'trips' ? (
                <div className="mt-5 divide-y divide-[#edf2ef]">
                  {trips.map((trip) => (
                    <div key={trip.id} className="py-4">
                      <p className="font-bold">
                        {routes.find((route) => route.id === trip.route_id)?.name ?? 'Route'} ·{' '}
                        {buses.find((bus) => bus.id === trip.bus_id)?.registration ?? 'Vehicle'}
                      </p>
                      <p className="mt-1 text-xs capitalize text-[#71827c]">
                        {trip.status} ·{' '}
                        {staff.find((member) => member.id === trip.supervisor_id)?.full_name ??
                          'Supervisor'}
                      </p>
                      {trip.started_at ? (
                        <p className="mt-1 text-xs text-[#71827c]">
                          Started {new Date(trip.started_at).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {trips.length === 0 ? <Empty>No trips scheduled yet.</Empty> : null}
                </div>
              ) : null}
              {tab === 'staff' ? (
                <div className="mt-5 divide-y divide-[#edf2ef]">
                  {staff.map((member) => (
                    <div key={member.id} className="py-4">
                      <p className="font-bold">{member.full_name}</p>
                      <p className="mt-1 text-xs capitalize text-[#71827c]">
                        {member.role.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                  {staff.length === 0 ? <Empty>No staff accounts found.</Empty> : null}
                </div>
              ) : null}
              {tab === 'billing' ? (
                <div className="mt-5 divide-y divide-[#edf2ef]">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div>
                        <p className="font-bold">
                          {invoice.currency} {Number(invoice.amount_usd).toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-[#71827c]">
                          Due {invoice.due_date} · {invoice.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {invoice.status !== 'paid' && invoice.status !== 'void' ? (
                          <button
                            onClick={() => {
                              setPaymentInvoiceId(invoice.id);
                              setPaymentAmount(String(invoice.amount_usd));
                              setPaymentReference('');
                            }}
                            className="rounded-lg border border-[#0b8067] px-3 py-2 text-xs font-bold text-[#0b8067]"
                          >
                            Record verified payment
                          </button>
                        ) : null}
                        {invoice.status === 'pending' ? (
                          <button
                            onClick={() => void voidInvoice(invoice.id)}
                            className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold"
                          >
                            Void invoice
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {invoices.length === 0 ? <Empty>No invoices issued yet.</Empty> : null}
                  <p className="mt-5 text-xs leading-5 text-[#8a9a93]">
                    Manual reconciliation records cash or bank transfers only after the school has
                    independently checked the receipt. This does not process card or mobile-money payments.
                  </p>
                </div>
              ) : null}
            </section>
            <aside className="h-fit rounded-2xl border border-[#e3ece7] bg-white p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">
                {tab === 'children'
                  ? 'Add a child'
                  : tab === 'fleet'
                    ? 'Register a vehicle'
                    : tab === 'routes'
                      ? 'Create a route'
                      : tab === 'trips'
                        ? 'Schedule a trip'
                        : tab === 'billing'
                          ? 'Issue an invoice'
                          : 'Invite a staff member'}
              </h2>
              {tab === 'children' ? (
                <form onSubmit={(e) => void createChild(e)} className="mt-4 space-y-3">
                  <Field label="Child's first name">
                    <input
                      required
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Class / group">
                    <input
                      value={childClass}
                      onChange={(e) => setChildClass(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Parent / guardian account">
                    <select
                      required
                      value={childGuardian}
                      onChange={(e) => setChildGuardian(e.target.value)}
                      className="control"
                    >
                      <option value="">Select a parent account</option>
                      {guardians.map((guardian) => (
                        <option key={guardian.id} value={guardian.id}>{guardian.full_name}</option>
                      ))}
                    </select>
                  </Field>
                  {guardians.length === 0 ? (
                    <p className="text-xs leading-5 text-amber-700">
                      No parent accounts are registered for this school yet. Create the parent account before enrolling the child.
                    </p>
                  ) : null}
                  <Submit disabled={saving || guardians.length === 0}>Add child and link parent</Submit>
                </form>
              ) : null}
              {tab === 'fleet' ? (
                <form onSubmit={(e) => void createBus(e)} className="mt-4 space-y-3">
                  <Field label="Registration">
                    <input
                      required
                      value={busRegistration}
                      onChange={(e) => setBusRegistration(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Make">
                    <input
                      value={busMake}
                      onChange={(e) => setBusMake(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Model">
                    <input
                      value={busModel}
                      onChange={(e) => setBusModel(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Passenger capacity">
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      value={busCapacity}
                      onChange={(e) => setBusCapacity(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Submit disabled={saving}>Register vehicle</Submit>
                </form>
              ) : null}
              {tab === 'routes' ? (
                <form onSubmit={(e) => void createRoute(e)} className="mt-4 space-y-3">
                  <Field label="Route name">
                    <input
                      required
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Route type">
                    <select
                      value={routeType}
                      onChange={(e) => setRouteType(e.target.value as 'pickup' | 'dropoff')}
                      className="control"
                    >
                      <option value="pickup">Morning pickup</option>
                      <option value="dropoff">Afternoon drop-off</option>
                    </select>
                  </Field>
                  <Submit disabled={saving}>Create route</Submit>
                </form>
              ) : null}
              {tab === 'trips' ? (
                <form onSubmit={(e) => void createTrip(e)} className="mt-4 space-y-3">
                  <Field label="Field-checked route">
                    <select
                      required
                      value={tripRoute}
                      onChange={(e) => setTripRoute(e.target.value)}
                      className="control"
                    >
                      <option value="">Select a route</option>
                      {routes
                        .filter(
                          (route) =>
                            route.geometry_status === 'manually_verified' &&
                            routeAssignments.some((assignment) => assignment.route_id === route.id),
                        )
                        .map((route) => (
                          <option key={route.id} value={route.id}>
                            {route.name} · {route.type}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Active vehicle">
                    <select
                      required
                      value={tripBus}
                      onChange={(e) => setTripBus(e.target.value)}
                      className="control"
                    >
                      <option value="">Select a vehicle</option>
                      {buses
                        .filter((bus) => bus.active)
                        .map((bus) => (
                          <option key={bus.id} value={bus.id}>
                            {bus.registration}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Supervisor">
                    <select
                      required
                      value={tripSupervisor}
                      onChange={(e) => setTripSupervisor(e.target.value)}
                      className="control"
                    >
                      <option value="">Select a supervisor</option>
                      {staff
                        .filter((member) => member.role === 'supervisor')
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Submit disabled={saving}>Schedule trip</Submit>
                </form>
              ) : null}
              {tab === 'staff' ? (
                <form onSubmit={(e) => void inviteStaff(e)} className="mt-4 space-y-3">
                  <Field label="Full name">
                    <input
                      required
                      minLength={2}
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Email address">
                    <input
                      required
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Role">
                    <select
                      value={staffRole}
                      onChange={(e) =>
                        setStaffRole(e.target.value as 'supervisor' | 'school_admin')
                      }
                      className="control"
                    >
                      <option value="supervisor">Transport supervisor</option>
                      <option value="school_admin">School administrator</option>
                    </select>
                  </Field>
                  <Submit disabled={saving}>Send invitation</Submit>
                </form>
              ) : null}
              {tab === 'billing' ? (
                <>
                <form onSubmit={(e) => void createInvoice(e)} className="mt-4 space-y-3">
                  <Field label="Parent / guardian">
                    <select
                      required
                      value={invoiceGuardian}
                      onChange={(e) => setInvoiceGuardian(e.target.value)}
                      className="control"
                    >
                      <option value="">Select a parent</option>
                      {guardians.map((guardian) => (
                        <option key={guardian.id} value={guardian.id}>
                          {guardian.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount (USD)">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Field label="Due date">
                    <input
                      required
                      type="date"
                      value={invoiceDue}
                      onChange={(e) => setInvoiceDue(e.target.value)}
                      className="control"
                    />
                  </Field>
                  <Submit disabled={saving}>Issue invoice</Submit>
                </form>
                {paymentInvoiceId ? (
                  <form onSubmit={(e) => void recordManualPayment(e)} className="mt-6 space-y-3 border-t border-[#e7efeb] pt-5">
                    <h3 className="text-sm font-extrabold">Record verified payment</h3>
                    <p className="text-xs text-[#71827c]">
                      Invoice {paymentInvoiceId.slice(0, 8)} · {invoices.find((invoice) => invoice.id === paymentInvoiceId)?.currency ?? 'USD'}
                    </p>
                    <Field label="Amount received">
                      <input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="control" />
                    </Field>
                    <Field label="Receipt / transaction reference">
                      <input required maxLength={120} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="control" />
                    </Field>
                    <Submit disabled={saving}>Save payment record</Submit>
                    <button type="button" onClick={() => setPaymentInvoiceId('')} className="w-full py-2 text-xs font-bold text-[#71827c]">Cancel</button>
                  </form>
                ) : null}
                </>
              ) : null}
              <p className="mt-5 text-xs leading-5 text-[#8a9a93]">
                All operations are checked by the signed-in account and enforced by database
                row-level security.
              </p>
            </aside>
          </div>
        )}
      </div>
      <style jsx global>{`
        .control {
          width: 100%;
          height: 44px;
          border: 1px solid #dce7e2;
          border-radius: 10px;
          padding: 0 12px;
          background: #fbfdfc;
          color: #17382f;
          font-size: 14px;
        }
        .control:focus {
          outline: 2px solid #0b8067;
          outline-offset: 1px;
        }
      `}</style>
    </main>
  );
}

function ChildRow({
  child,
  onSave,
  onArchive,
}: {
  child: Child;
  onSave: (id: string, name: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(child.first_name);
  return (
    <div className="flex flex-wrap items-center gap-3 py-4">
      <div className="min-w-0 flex-1">
        <input
          aria-label="Child first name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="control max-w-sm"
        />
        <p className="mt-1 text-xs text-[#71827c]">{child.class_name || 'Class not assigned'}</p>
      </div>
      <button
        onClick={() => void onSave(child.id, name)}
        className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold"
      >
        Save
      </button>
      <button
        onClick={() => void onArchive(child.id)}
        className="rounded-lg border border-[#f1d2ce] px-3 py-2 text-xs font-bold text-red-700"
      >
        Archive
      </button>
    </div>
  );
}
function RouteRow({
  route,
  stops,
  childOptions,
  assignments,
  onSave,
  onArchive,
  onAddStop,
  onBuildGeometry,
  onFieldCheck,
  onAssignChild,
  onRemoveChild,
}: {
  route: Route;
  stops: Stop[];
  childOptions: Child[];
  assignments: RouteAssignment[];
  onSave: (id: string, name: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onAddStop: (routeId: string, name: string, lat: number, lng: number) => Promise<void>;
  onBuildGeometry: (routeId: string) => Promise<void>;
  onFieldCheck: (routeId: string) => Promise<void>;
  onAssignChild: (routeId: string, childId: string) => Promise<void>;
  onRemoveChild: (assignmentId: string) => Promise<void>;
}) {
  const [name, setName] = useState(route.name);
  const [stopName, setStopName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const availableChildren = childOptions.filter(
    (child) => !assignments.some((assignment) => assignment.child_id === child.id),
  );
  return (
    <div className="py-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Route name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="control max-w-sm flex-1"
        />
        <span className="rounded-full bg-[#edf5f1] px-3 py-1 text-xs font-bold capitalize">
          {route.type}
        </span>
        <button
          onClick={() => void onSave(route.id, name)}
          className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold"
        >
          Save
        </button>
        <button
          onClick={() => void onArchive(route.id)}
          className="rounded-lg border border-[#f1d2ce] px-3 py-2 text-xs font-bold text-red-700"
        >
          Archive
        </button>
      </div>
      <div className="mt-4 rounded-xl bg-[#f7faf8] p-3">
        <p className="text-xs font-extrabold text-[#49665b]">
          Child manifest · {assignments.length}
        </p>
        {assignments.map((assignment) => (
          <div key={assignment.id} className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[#58746A]">
              {childOptions.find((child) => child.id === assignment.child_id)?.first_name ??
                'Archived child'}
            </span>
            <button
              onClick={() => void onRemoveChild(assignment.id)}
              className="text-xs font-bold text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedChildId) {
              void onAssignChild(route.id, selectedChildId);
              setSelectedChildId('');
            }
          }}
          className="mt-3 flex gap-2"
        >
          <select
            value={selectedChildId}
            onChange={(event) => setSelectedChildId(event.target.value)}
            className="control min-w-0 flex-1"
          >
            <option value="">Assign a child</option>
            {availableChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {child.first_name} · {child.class_name ?? 'No class'}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedChildId}
            className="rounded-lg bg-[#edf5f1] px-3 py-2 text-xs font-bold text-[#28624F] disabled:opacity-40"
          >
            Assign
          </button>
        </form>
      </div>
      <p className="mt-3 text-xs text-[#71827c]">
        {stops.length} ordered stops · Geometry:{' '}
        {route.geometry_status === 'manually_verified'
          ? 'field checked'
          : (route.geometry_status ?? 'unverified')}
        {route.distance_m ? ` · ${(route.distance_m / 1000).toFixed(1)} km` : ''}
      </p>
      <div className="mt-2 space-y-1">
        {stops.map((stop) => (
          <p key={stop.id} className="text-xs text-[#58746A]">
            {stop.position + 1}. {stop.name} ({stop.lat.toFixed(4)}, {stop.lng.toFixed(4)})
          </p>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const latitude = Number(lat);
          const longitude = Number(lng);
          if (
            !stopName.trim() ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          )
            return;
          void onAddStop(route.id, stopName, latitude, longitude);
          setStopName('');
          setLat('');
          setLng('');
        }}
        className="mt-3 grid gap-2 sm:grid-cols-2"
      >
        <input
          required
          aria-label="Stop name"
          placeholder="Stop name"
          value={stopName}
          onChange={(e) => setStopName(e.target.value)}
          className="control"
        />
        <input
          required
          aria-label="Latitude"
          type="number"
          step="any"
          placeholder="Latitude"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="control"
        />
        <input
          required
          aria-label="Longitude"
          type="number"
          step="any"
          placeholder="Longitude"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="control"
        />
        <button className="rounded-lg bg-[#edf5f1] px-3 py-2 text-xs font-bold text-[#28624F]">
          Add stop
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void onBuildGeometry(route.id)}
          disabled={stops.length < 2}
          className="rounded-lg bg-[#0b6b58] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Calculate road route
        </button>
        {route.geometry_status === 'provider_verified' ? (
          <button
            onClick={() => void onFieldCheck(route.id)}
            className="rounded-lg border border-[#0b6b58] px-3 py-2 text-xs font-bold text-[#0b6b58]"
          >
            Confirm field check
          </button>
        ) : null}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-[#49665b]">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
function Submit({ children, disabled }: { children: React.ReactNode; disabled: boolean }) {
  return (
    <button
      disabled={disabled}
      className="w-full rounded-xl bg-[#0b6b58] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-sm text-[#91a19a]">{children}</p>;
}
