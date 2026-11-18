'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured. Add the web environment variables first.');
      setBusy(false);
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }
    window.location.assign('/dashboard');
  }
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-[2rem] border border-[#e3ece7] bg-white p-8 shadow-xl shadow-[#21483c]/5">
        <a href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0b6b58] text-2xl font-black text-white">
            p
          </span>
          <span className="text-xl font-extrabold">preDrive</span>
        </a>
        <p className="mt-10 text-xs font-extrabold tracking-[.2em] text-[#0b8067]">SCHOOL PORTAL</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-[#71827c]">
          Sign in using the account provided by your school or preDrive administrator.
        </p>
        <form onSubmit={signIn} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-[#35544a]">Email address</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#dce7e2] bg-[#fbfdfc] px-4 text-sm outline-none focus:border-[#0b8067]"
              placeholder="you@school.co.zw"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-[#35544a]">Password</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-[#dce7e2] bg-[#fbfdfc] px-4 text-sm outline-none focus:border-[#0b8067]"
              placeholder="Enter your password"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-[#fff0ef] p-3 text-xs text-[#b42318]">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="h-12 w-full rounded-xl bg-[#0b6b58] text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs leading-5 text-[#91a19a]">
          Access is managed by your school. Contact your administrator if you need help.
        </p>
      </section>
    </main>
  );
}
