import {
  DEMO_SCHOOL_ID,
  DEMO_USERS,
  isStrongDemoPassword,
} from "./seed-auth-users.ts";

Deno.test("demo Auth seed defines exactly the five brief roles", () => {
  const roles = DEMO_USERS.map((user) => user.role).sort();
  if (roles.join(",") !== "driver,guardian,school_admin,supervisor,teacher") {
    throw new Error("Demo roles do not match the product brief.");
  }
});

Deno.test("demo Auth seed uses reserved non-deliverable demo email domains", () => {
  if (DEMO_USERS.some((user) => !user.email.endsWith(".invalid"))) {
    throw new Error("Demo accounts must not target deliverable real email addresses.");
  }
});

Deno.test("demo Auth seed uses Zimbabwean phone formats", () => {
  if (DEMO_USERS.some((user) => !/^\+2637\d{8}$/.test(user.phone))) {
    throw new Error("Every demo account must use a valid-shaped Zimbabwean mobile number.");
  }
});

Deno.test("demo Auth seed has stable role-specific password environment names", () => {
  const names = DEMO_USERS.map((user) => user.passwordEnv);
  if (new Set(names).size !== 5 || names.some((name) => !name.startsWith("PREDRIVE_DEMO_") || !name.endsWith("_PASSWORD"))) {
    throw new Error("Demo password environment variable names are not unique and role-scoped.");
  }
});

Deno.test("demo Auth seed password policy rejects weak or malformed values", () => {
  const accepted = ["Long-Unique-Demo-Passphrase-2026!", "1234567890123456"];
  const rejected = ["short", "               ", "123456789012345", "x".repeat(129), "validpassword\u0000hidden"];
  if (accepted.some((password) => !isStrongDemoPassword(password))) {
    throw new Error("A valid demo password was rejected.");
  }
  if (rejected.some((password) => isStrongDemoPassword(password))) {
    throw new Error("A weak or malformed demo password was accepted.");
  }
});

Deno.test("demo Auth seed is pinned to the canonical Greenfield tenant", () => {
  if (DEMO_SCHOOL_ID !== "10000000-0000-4000-8000-000000000001") {
    throw new Error("Demo Auth seed tenant ID changed unexpectedly.");
  }
});
