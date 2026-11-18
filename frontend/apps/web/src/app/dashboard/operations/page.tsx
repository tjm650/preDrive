'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Tab = 'children' | 'fleet' | 'routes' | 'billing';
type Child = { id: string; first_name: string; class_name: string | null; archived_at: string | null };
type Bus = { id: string; registration: string; make: string | null; model: string | null; capacity: number; active: boolean; archived_at: string | null };
type Route = { id: string; name: string; type: 'pickup' | 'dropoff'; archived_at: string | null };
type Invoice = { id: string; amount_usd: number; currency: string; status: string; due_date: string; guardian_id: string | null };
type Guardian = { id: string; full_name: string; role: string };

const tabs: { id: Tab; label: string }[] = [
  { id: 'children', label: 'Children' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'routes', label: 'Routes' },
  { id: 'billing', label: 'Billing' },
];

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('children');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [busRegistration, setBusRegistration] = useState('');
  const [busMake, setBusMake] = useState('');
  const [busModel, setBusModel] = useState('');
  const [busCapacity, setBusCapacity] = useState('16');
  const [routeName, setRouteName] = useState('');
  const [routeType, setRouteType] = useState<'pickup' | 'dropoff'>('pickup');
  const [invoiceGuardian, setInvoiceGuardian] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDue, setInvoiceDue] = useState('');

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
    const [childRows, busRows, routeRows, invoiceRows, guardianRows] = await Promise.all([
      client.from('children').select('*').eq('school_id', profile.school_id).order('first_name'),
      client.from('buses').select('*').eq('school_id', profile.school_id).order('registration'),
      client.from('routes').select('*').eq('school_id', profile.school_id).order('name'),
      client.from('invoices').select('*').eq('school_id', profile.school_id).order('due_date', { ascending: false }),
      client.from('profiles').select('id,full_name,role').eq('school_id', profile.school_id).eq('role', 'parent').order('full_name'),
    ]);
    if (childRows.error || busRows.error || routeRows.error || invoiceRows.error || guardianRows.error) {
      setError('Some records could not be loaded. Check the school permissions and retry.');
    }
    setChildren(((childRows.data ?? []) as unknown as Child[]).filter((row) => !row.archived_at));
    setBuses(((busRows.data ?? []) as unknown as Bus[]).filter((row) => !row.archived_at));
    setRoutes(((routeRows.data ?? []) as unknown as Route[]).filter((row) => !row.archived_at));
    setInvoices((invoiceRows.data ?? []) as unknown as Invoice[]);
    setGuardians((guardianRows.data ?? []) as Guardian[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      const { error: insertError } = await client.from('children').insert({
        school_id: schoolId, first_name: childName.trim(), class_name: childClass.trim() || null,
      });
      if (insertError) throw insertError;
      setChildName(''); setChildClass('');
    });
  }

  async function createBus(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !schoolId) throw new Error('School session is unavailable.');
      const capacity = Number(busCapacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error('Enter a valid bus capacity.');
      const { error: insertError } = await client.from('buses').insert({
        school_id: schoolId, registration: busRegistration.trim().toUpperCase(),
        make: busMake.trim() || null, model: busModel.trim() || null, capacity,
      });
      if (insertError) throw insertError;
      setBusRegistration(''); setBusMake(''); setBusModel('');
    });
  }

  async function createRoute(event: FormEvent<HTMLFormElement>) {
    await submit(event, async () => {
      const client = createClient();
      if (!client || !schoolId) throw new Error('School session is unavailable.');
      const { error: insertError } = await client.from('routes').insert({
        school_id: schoolId, name: routeName.trim(), type: routeType,
      });
      if (insertError) throw insertError;
      setRouteName('');
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
        school_id: schoolId, guardian_id: invoiceGuardian, amount_usd: amount,
        currency: 'USD', status: 'pending', due_date: invoiceDue,
      });
      if (insertError) throw insertError;
      setInvoiceAmount(''); setInvoiceDue('');
    });
  }

  async function renameChild(id: string, name: string) {
    const client = createClient();
    if (!client || !name.trim()) return;
    const { error: updateError } = await client.from('children').update({ first_name: name.trim() }).eq('id', id);
    if (updateError) setError(updateError.message); else await load();
  }
  async function toggleBus(bus: Bus) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client.from('buses').update({ active: !bus.active }).eq('id', bus.id);
    if (updateError) setError(updateError.message); else await load();
  }
  async function renameRoute(id: string, name: string) {
    const client = createClient();
    if (!client || !name.trim()) return;
    const { error: updateError } = await client.from('routes').update({ name: name.trim() }).eq('id', id);
    if (updateError) setError(updateError.message); else await load();
  }
  async function voidInvoice(id: string) {
    const client = createClient();
    if (!client) return;
    const { error: updateError } = await client.from('invoices').update({ status: 'void' }).eq('id', id).eq('status', 'pending');
    if (updateError) setError(updateError.message); else await load();
  }

  return (
    <main className="min-h-screen bg-[#f5f8f7] px-5 py-8 text-[#17382f] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><a href="/dashboard" className="text-sm font-bold text-[#0b8067]">← Dashboard</a><h1 className="mt-3 text-3xl font-black">School operations</h1><p className="mt-1 text-sm text-[#71827c]">Manage records within your school workspace.</p></div>
          <form action="/auth/signout" method="post"><button className="rounded-full border border-[#d6e3dd] bg-white px-4 py-2 text-xs font-bold">Sign out</button></form>
        </div>
        <div className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-[#e3ece7] bg-white p-2">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === item.id ? 'bg-[#0b6b58] text-white' : 'text-[#60756d] hover:bg-[#f0f5f2]'}`}>{item.label}</button>)}
        </div>
        {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}
        {loading ? <p className="mt-8 text-sm text-[#71827c]">Loading school records…</p> : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-[#e3ece7] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-extrabold">{tab === 'children' ? 'Registered children' : tab === 'fleet' ? 'School fleet' : tab === 'routes' ? 'Transport routes' : 'Invoices'}</h2>
              {tab === 'children' ? <div className="mt-5 divide-y divide-[#edf2ef]">{children.map((child) => <ChildRow key={child.id} child={child} onSave={renameChild} />)}{children.length === 0 ? <Empty>No children registered yet.</Empty> : null}</div> : null}
              {tab === 'fleet' ? <div className="mt-5 divide-y divide-[#edf2ef]">{buses.map((bus) => <div key={bus.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-bold">{bus.registration}</p><p className="mt-1 text-xs text-[#71827c]">{[bus.make,bus.model].filter(Boolean).join(' ') || 'Vehicle'} · Capacity {bus.capacity}</p><p className="mt-1 text-xs">{bus.active ? 'Active' : 'Inactive'}</p></div><button onClick={() => void toggleBus(bus)} className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold">{bus.active ? 'Deactivate' : 'Activate'}</button></div>)}{buses.length === 0 ? <Empty>No vehicles registered yet.</Empty> : null}</div> : null}
              {tab === 'routes' ? <div className="mt-5 divide-y divide-[#edf2ef]">{routes.map((route) => <RouteRow key={route.id} route={route} onSave={renameRoute} />)}{routes.length === 0 ? <Empty>No routes configured yet.</Empty> : null}</div> : null}
              {tab === 'billing' ? <div className="mt-5 divide-y divide-[#edf2ef]">{invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{invoice.currency} {Number(invoice.amount_usd).toFixed(2)}</p><p className="mt-1 text-xs text-[#71827c]">Due {invoice.due_date} · {invoice.status}</p></div>{invoice.status === 'pending' ? <button onClick={() => void voidInvoice(invoice.id)} className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold">Void invoice</button> : null}</div>)}{invoices.length === 0 ? <Empty>No invoices issued yet.</Empty> : null}<p className="mt-5 text-xs leading-5 text-[#8a9a93]">Payments are not marked as received here. Payment confirmation must come from a verified payment-provider callback.</p></div> : null}
            </section>
            <aside className="h-fit rounded-2xl border border-[#e3ece7] bg-white p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">{tab === 'children' ? 'Add a child' : tab === 'fleet' ? 'Register a vehicle' : tab === 'routes' ? 'Create a route' : 'Issue an invoice'}</h2>
              {tab === 'children' ? <form onSubmit={(e) => void createChild(e)} className="mt-4 space-y-3"><Field label="Child's first name"><input required value={childName} onChange={(e) => setChildName(e.target.value)} className="control" /></Field><Field label="Class / group"><input value={childClass} onChange={(e) => setChildClass(e.target.value)} className="control" /></Field><Submit disabled={saving}>Add child</Submit></form> : null}
              {tab === 'fleet' ? <form onSubmit={(e) => void createBus(e)} className="mt-4 space-y-3"><Field label="Registration"><input required value={busRegistration} onChange={(e) => setBusRegistration(e.target.value)} className="control" /></Field><Field label="Make"><input value={busMake} onChange={(e) => setBusMake(e.target.value)} className="control" /></Field><Field label="Model"><input value={busModel} onChange={(e) => setBusModel(e.target.value)} className="control" /></Field><Field label="Passenger capacity"><input required type="number" min="1" max="100" value={busCapacity} onChange={(e) => setBusCapacity(e.target.value)} className="control" /></Field><Submit disabled={saving}>Register vehicle</Submit></form> : null}
              {tab === 'routes' ? <form onSubmit={(e) => void createRoute(e)} className="mt-4 space-y-3"><Field label="Route name"><input required value={routeName} onChange={(e) => setRouteName(e.target.value)} className="control" /></Field><Field label="Route type"><select value={routeType} onChange={(e) => setRouteType(e.target.value as 'pickup' | 'dropoff')} className="control"><option value="pickup">Morning pickup</option><option value="dropoff">Afternoon drop-off</option></select></Field><Submit disabled={saving}>Create route</Submit></form> : null}
              {tab === 'billing' ? <form onSubmit={(e) => void createInvoice(e)} className="mt-4 space-y-3"><Field label="Parent / guardian"><select required value={invoiceGuardian} onChange={(e) => setInvoiceGuardian(e.target.value)} className="control"><option value="">Select a parent</option>{guardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.full_name}</option>)}</select></Field><Field label="Amount (USD)"><input required type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} className="control" /></Field><Field label="Due date"><input required type="date" value={invoiceDue} onChange={(e) => setInvoiceDue(e.target.value)} className="control" /></Field><Submit disabled={saving}>Issue invoice</Submit></form> : null}
              <p className="mt-5 text-xs leading-5 text-[#8a9a93]">All operations are checked by the signed-in account and enforced by database row-level security.</p>
            </aside>
          </div>
        )}
      </div>
      <style jsx global>{`.control{width:100%;height:44px;border:1px solid #dce7e2;border-radius:10px;padding:0 12px;background:#fbfdfc;color:#17382f;font-size:14px}.control:focus{outline:2px solid #0b8067;outline-offset:1px}`}</style>
    </main>
  );
}

function ChildRow({ child, onSave }: { child: Child; onSave: (id: string, name: string) => Promise<void> }) {
  const [name, setName] = useState(child.first_name);
  return <div className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><input aria-label="Child first name" value={name} onChange={(e) => setName(e.target.value)} className="control max-w-sm" /><p className="mt-1 text-xs text-[#71827c]">{child.class_name || 'Class not assigned'}</p></div><button onClick={() => void onSave(child.id, name)} className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold">Save</button></div>;
}
function RouteRow({ route, onSave }: { route: Route; onSave: (id: string, name: string) => Promise<void> }) {
  const [name, setName] = useState(route.name);
  return <div className="flex flex-wrap items-center gap-3 py-4"><input aria-label="Route name" value={name} onChange={(e) => setName(e.target.value)} className="control max-w-sm flex-1" /><span className="rounded-full bg-[#edf5f1] px-3 py-1 text-xs font-bold capitalize">{route.type}</span><button onClick={() => void onSave(route.id, name)} className="rounded-lg border border-[#d6e3dd] px-3 py-2 text-xs font-bold">Save</button></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-[#49665b]">{label}<span className="mt-2 block">{children}</span></label>; }
function Submit({ children, disabled }: { children: React.ReactNode; disabled: boolean }) { return <button disabled={disabled} className="w-full rounded-xl bg-[#0b6b58] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{children}</button>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="py-8 text-sm text-[#91a19a]">{children}</p>; }
