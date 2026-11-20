const features = [
  [
    '01',
    'Live journey visibility',
    'Know where the school bus is while a trip is active, with privacy controls built in.',
  ],
  [
    '02',
    'Verified child handovers',
    'Keep a clear record of boarding, arrival and authorized collection.',
  ],
  [
    '03',
    'Safety-first alerts',
    'Escalate delays, SOS events and children who are not accounted for.',
  ],
];
export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0b6b58] text-2xl font-black text-white">
            p
          </span>
          <span className="text-xl font-extrabold tracking-tight">preDrive</span>
        </a>
        <a
          href="/dashboard"
          className="rounded-full border border-[#d6e3dd] bg-white px-5 py-2.5 text-sm font-bold text-[#21483c]"
        >
          School portal ↗
        </a>
      </nav>
      <section className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-20">
        <div>
          <p className="mb-5 text-xs font-extrabold tracking-[.22em] text-[#0b8067]">
            SCHOOL TRANSPORT. WITH CARE.
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.04] tracking-[-.055em] text-[#102d27] sm:text-6xl lg:text-7xl">
            Every journey.
            <br />
            Every child.
            <br />
            <span className="text-[#0b8067]">Accounted for.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#71827c]">
            A calmer, clearer way for Zimbabwean creches and pre-schools to manage school transport,
            keep families informed and put child safety first.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="rounded-full bg-[#0b6b58] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-[#0b6b58]/15"
            >
              Explore the school portal
            </a>
            <a
              href="mailto:hello@predrive.co.zw?subject=preDrive%20demo"
              className="rounded-full border border-[#d6e3dd] bg-white px-7 py-4 text-sm font-bold text-[#21483c]"
            >
              Request a demo
            </a>
          </div>
          <p className="mt-7 text-xs text-[#91a19a]">
            Designed for schools, supervisors and parents across Zimbabwe.
          </p>
        </div>
        <div className="relative">
          <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-[#d8eee6] via-[#eff5ef] to-[#f3e9d5] blur-2xl" />
          <div className="relative rounded-[2rem] border border-white bg-white/90 p-5 shadow-2xl shadow-[#21483c]/10 sm:p-7">
            <div className="flex items-center justify-between border-b border-[#edf1ee] pb-5">
              <div>
                <p className="text-xs font-bold text-[#8a9a93]">LITTLE SPROUTS CRECHE</p>
                <h2 className="mt-1 text-xl font-extrabold">Transport overview</h2>
              </div>
              <span className="rounded-full bg-[#e8f4ee] px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-[#18765e]">
                DEMO
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f4f8f6] p-4">
                <p className="text-xs font-semibold text-[#83938c]">Children on routes</p>
                <p className="mt-2 text-3xl font-black">24</p>
                <p className="mt-1 text-[11px] text-[#83938c]">Across 3 buses</p>
              </div>
              <div className="rounded-2xl bg-[#f4f8f6] p-4">
                <p className="text-xs font-semibold text-[#83938c]">Active journeys</p>
                <p className="mt-2 text-3xl font-black">02</p>
                <p className="mt-1 text-[11px] text-[#83938c]">Illustrative data</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[#e7eeea] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold">Borrowdale route</span>
                <span className="flex items-center gap-2 text-[11px] font-bold text-[#178066]">
                  <i className="h-2 w-2 rounded-full bg-[#24a17d]" /> Monitored
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f3ee] text-lg">
                  🚌
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">AFD 4821</p>
                  <p className="text-xs text-[#83938c]">Supervisor assigned</p>
                </div>
                <span className="text-xs font-bold text-[#71827c]">14 seats</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2ef]">
                <div className="h-full w-[68%] rounded-full bg-[#0b8067]" />
              </div>
              <p className="mt-2 text-[10px] text-[#91a19a]">
                Sample interface preview · Not live vehicle data
              </p>
            </div>
            <div className="mt-4 rounded-2xl bg-[#fff7e8] p-4">
              <p className="text-xs font-extrabold text-[#8d6424]">SAFETY CHECK</p>
              <p className="mt-1 text-sm font-semibold text-[#6e572f]">
                Every child must be accounted for before a trip can be closed.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="border-y border-[#e5ede8] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <p className="text-xs font-extrabold tracking-[.2em] text-[#0b8067]">
            BUILT AROUND TRUST
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {features.map(([number, title, description]) => (
              <article key={number}>
                <p className="text-xs font-black text-[#91a59c]">{number}</p>
                <h3 className="mt-3 text-xl font-extrabold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#71827c]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-[#91a19a] lg:px-10">
        <span>© {new Date().getFullYear()} preDrive · Zimbabwe</span>
        <span>Safer school journeys start with accountability.</span>
      </footer>
    </main>
  );
}
