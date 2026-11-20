# preDrive: Product Brief

## Product
"preDrive" is a mobile app and school dashboard for creches and preschools in Zimbabwe. It tracks every school bus trip live and keeps a verified record of every child handover. It is sold B2B to schools and doubles as a sales demo: a landing page pitches the product, then the visitor signs in as a role and uses a fully working system with realistic data.

## How it works
1. The supervisor starts the trip. Bus location is shared only while the trip is active.
2. Guardians see the bus approach on a live map with a countdown. When the bus enters their chosen radius (500 m, 1 km or 2 km) they get: "Bus is about 5 minutes from your gate. Please get Tendai ready."
3. Every handover is confirmed. Children are checked on and off the bus. At the gate the receiving adult must be pre-approved by the guardian and enter a PIN.
4. Nothing falls through the cracks. If a trip ends with a child unaccounted for, guardian and admin get urgent alerts that repeat until someone acknowledges. SOS and delay reports alert everyone instantly.
5. The school gets control: live view of all buses, routes, staff and children, incidents, on-time and attendance analytics, emergency broadcasts.
6. Guardians see the fee structure and pay by CBZ, CABS or EcoCash (simulated in the demo).
7. Everything works in English, Shona and Ndebele.

## Roles
- School Admin: web dashboard.
- Guardian, Teacher/Supervisor, Driver: mobile app (also runnable in a browser via Expo web export).
- Supervisor: starts and ends trips, checks children on/off, verifies gate-handover PINs, raises SOS, logs incidents.
- Driver: vehicle check, route view, delay reports, SOS. The driver never handles handovers.

## Market
Zimbabwe. USD and ZiG. Show USD with a ZiG equivalent using one configurable exchange rate stored in settings, labelled "indicative rate". Format: US$380.00 and ZiG 10,260.00. Payment methods: CBZ, CABS, EcoCash. No WhatsApp.

## Stack and structure (exact)
- Mobile: Expo (React Native, TypeScript, Expo Router).
- Web: Next.js App Router (TypeScript, Tailwind, Framer Motion) on Vercel.
- Backend and database: Supabase only (Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron).
- pnpm monorepo:

preDrive/
  docs/BRIEF.md
  frontend/
    shared/   (i18n/ en.json sn.json nd.json; types/; tokens/; lib/ geo, ETA, currency, alert builders, trip simulator, api/ data layer)
    mobile/   (app/ thin Expo Router routes; screens/ guardian, supervisor, driver, auth; components/ ui, map, trip, alerts, fees; src/ lib, hooks, store, services; assets/)
    web/      (app/ with (marketing) landing, signin, admin/*, demo/[role]; components/ ui, landing, admin, map, charts; lib/; styles/)
  supabase/   (migrations/, functions/, seed.sql, config.toml)
  scripts/    (seed-auth-users.ts, reset-demo.ts)
  package.json

- frontend/shared is a workspace package used by both apps.
- The Expo app is also exported to web and deployed as a second Vercel project. The landing page opens Guardian, Supervisor and Driver demos inside a centered phone frame (iframe to NEXT_PUBLIC_MOBILE_DEMO_URL), signed in via a secure postMessage session handshake, never a session in the URL. Use .web.tsx files where a native-only library is involved.
- Frontend talks to data only through frontend/shared/lib/api (typed API contract). Two adapters: MockAdapter (in-memory, persisted, seeded, behaves like realtime, enforces the same rules as the backend) and SupabaseAdapter. Screens never know which is active (env var switch).

## Design system (no deviation)
- Feel: calm, trustworthy, warm, premium. A safety-critical product made friendly. Not a generic SaaS template.
- Colours: Ink #0F2A43, Bus Yellow #F5B301 (single accent), Canvas #F6F4EE, Surface #FFFFFF, Line #E5E1D6, Success #1E9E6A, Danger #D64545, Warning #E08A00, Info #2563A8. No purple, neon, gradient backgrounds or glassmorphism.
- Type: Bricolage Grotesque (headings), DM Sans (body). Minimum 16px body on mobile.
- Icons: Lucide only. No emoji in the UI.
- 12px radius cards, pill buttons, 1px borders, very soft shadows, 8px grid.
- Motion: 150-200ms ease-out in apps. Landing page may use richer scroll animation (Framer Motion) but stays tasteful and respects prefers-reduced-motion.
- WCAG AA contrast, visible focus rings, 44px touch targets.
- Copy: short and plain. No explanatory paragraphs inside the app: labels, values and actions only.
- Every screen has loading, empty and error states. No blank screens.

## Languages
English, Shona, Ndebele via i18next in frontend/shared/i18n. Every visible string is a key. Language switcher on the landing page, sign-in and every role's settings; language persists (profiles.language). Natural, correct Shona and Ndebele, not literal machine translation, kept in one place for native-speaker proofreading. No overflow with longer strings.

## Demo data (fictional, realistic, consistent across all roles)
- School: Greenfield Early Learning Centre, Borrowdale, Harare. Ages 2-6, about 64 children, classes Sunbeams, Little Stars, Explorers.
- 3 buses and routes: A Borrowdale-Avondale, B Mount Pleasant-Highlands, C Mabelreign-Greendale. Zimbabwean-style plates (e.g. AGH 4521). 5-8 real-suburb stops each with plausible street names and a road path of 30+ coordinates.
- Children with realistic Shona, Ndebele and mixed names (Tendai Moyo, Rutendo Chikwanha, Nomsa Dube, Tafara Ndlovu, Anesu Sibanda, Thando Ncube and others). Each has class, route, stop, guardians and 1-3 approved collectors with relationship and +263 77/78/71 phone.
- Staff: admin Mrs. Patience Mhlanga, 3 supervisors, 3 drivers, 6 teachers.
- 4 weeks of history: completed trips, on-time stats, a few delay reports, 2 resolved incidents, attendance, fee payments (paid, partial, overdue).
- Fees per term: tuition, transport, meals, activity levy, typical Harare private-creche USD amounts.
- Demo accounts, one per role. Guardian: Mrs. Chipo Moyo (mother of Tendai on Route A, plus a second child). Supervisor and Driver on Route A.

## Engineering rules
- TypeScript strict, ESLint, Prettier, pnpm.
- Multi-school from day one: every table has school_id; RLS on every table.
- The service-role key never appears in client code. Admin actions go through Edge Functions.
- Location data exists only while a trip is active. Show this in the UI as a privacy promise.
- Handover PINs are never stored raw: hashed with pgcrypto and verified by an RPC that rate-limits and locks after 3 failures.
- Payments are simulated in the demo; keep the payments table and an Edge Function interface ready for a real gateway (e.g. Paynow).
- Demo bus movement is simulated along real route paths so the live map works in a pitch. Real GPS mode (expo-location, foreground) also exists; background GPS and push need an EAS development build, not Expo Go.
- Maps: react-native-maps on native; MapLibre or Leaflet on web. Styled SVG fallback if tiles fail.
