import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="min-h-screen p-10"><a href="/">← preDrive</a><h1 className="mt-10 text-3xl font-black">Connect Supabase</h1><p className="mt-3 text-[#71827c]">Set the web environment variables to load the school dashboard.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: profile }, children, buses, routes, alerts] = await Promise.all([
    supabase.from('profiles').select('full_name,role,school_id').eq('id',user.id).maybeSingle(),
    supabase.from('children').select('id',{count:'exact',head:true}),
    supabase.from('buses').select('id',{count:'exact',head:true}),
    supabase.from('routes').select('id',{count:'exact',head:true}),
    supabase.from('incidents').select('id',{count:'exact',head:true}).in('status',['open','investigating']),
  ]);
  if (!profile) redirect('/login');
  const stats = [['Children',children.count ?? 0,'Registered in this tenant'],['Buses',buses.count ?? 0,'Fleet records'],['Routes',routes.count ?? 0,'Configured routes'],['Open incidents',alerts.count ?? 0,'Needs attention']];
  return <main className="min-h-screen px-6 py-10"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between"><a href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0b6b58] text-xl font-black text-white">p</span><span className="font-extrabold">preDrive</span></a><form action="/auth/signout" method="post"><button className="rounded-full border border-[#d6e3dd] bg-white px-4 py-2 text-xs font-bold">Sign out</button></form></div><div className="mt-12 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[.2em] text-[#0b8067]">SCHOOL OPERATIONS</p><h1 className="mt-2 text-4xl font-black tracking-tight">Welcome, {profile.full_name.split(' ')[0]}</h1><p className="mt-2 text-sm capitalize text-[#71827c]">{profile.role.replace('_',' ')} · Live tenant-scoped data</p></div><span className="rounded-full bg-[#e8f4ee] px-4 py-2 text-xs font-bold text-[#18765e]">Authenticated</span></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label,value,detail])=><section key={label} className="rounded-2xl border border-[#e3ece7] bg-white p-6"><p className="text-sm font-semibold text-[#71827c]">{label}</p><p className="mt-3 text-4xl font-black">{value}</p><p className="mt-2 text-xs text-[#91a19a]">{detail}</p></section>)}</div><section className="mt-6 rounded-2xl border border-[#e3ece7] bg-white p-7"><h2 className="text-lg font-extrabold">Operational overview</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-[#71827c]">These counts are queried through your authenticated session and enforced by Supabase row-level security. Live vehicle operations, route editing, billing and incident workflows are being built on this foundation.</p></section></div></main>;
}
