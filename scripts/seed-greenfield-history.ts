type DemoHistoryResult = {
  trips: number;
  tripChildren: number;
  invoices: number;
  simulatedPayments: number;
  receipts: number;
  resolvedIncidents: number;
  delayReports: number;
};

const EXPECTED: DemoHistoryResult = {
  trips: 120,
  tripChildren: 2560,
  invoices: 64,
  simulatedPayments: 32,
  receipts: 32,
  resolvedIncidents: 2,
  delayReports: 4,
};

export function isValidDemoHistoryResult(value: unknown): value is DemoHistoryResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return Object.entries(EXPECTED).every(([key, expected]) => result[key] === expected);
}

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
}

function projectOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("SUPABASE_URL must use HTTPS outside local development.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("SUPABASE_URL must not contain credentials, query parameters or a fragment.");
  }
  return parsed.origin;
}

async function main(): Promise<void> {
  const origin = projectOrigin(required("SUPABASE_URL"));
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  let response: Response;
  try {
    response = await fetch(origin + "/rest/v1/rpc/seed_greenfield_demo_history", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch {
    throw new Error("Greenfield history RPC request failed. Check network access and project URL.");
  }

  if (!response.ok) {
    throw new Error(
      "Greenfield history RPC failed with HTTP " + response.status +
        ". Confirm the reviewed writer migration is applied and B5.1–B5.3 are complete.",
    );
  }

  const result: unknown = await response.json();
  if (!isValidDemoHistoryResult(result)) {
    throw new Error("Greenfield history RPC returned unexpected counts; stop and inspect the demo tenant.");
  }

  console.log(JSON.stringify({
    ...result,
    note: "Historical trips and payments are synthetic demo records. No external provider was contacted.",
  }));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Greenfield history seeding failed.");
    Deno.exit(1);
  }
}
