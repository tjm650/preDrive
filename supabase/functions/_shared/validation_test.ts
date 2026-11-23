import { parseJsonBody, z } from "./validation.ts";
import { HttpError } from "./errors.ts";

const InputSchema = z.object({
  schoolId: z.uuid(),
  limit: z.number().int().min(1).max(7).default(7),
});

Deno.test("JSON body validation returns normalized typed input", async () => {
  const request = new Request("https://edge.example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schoolId: "8e6c52e7-83f2-4a83-a5e5-35f7cccbde80",
    }),
  });

  const result = await parseJsonBody(request, InputSchema);
  if (result.limit !== 7) {
    throw new Error("Expected schema defaults to be applied.");
  }
});

Deno.test("JSON body validation rejects invalid UUIDs", async () => {
  const request = new Request("https://edge.example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schoolId: "not-a-uuid", limit: 7 }),
  });

  try {
    await parseJsonBody(request, InputSchema);
    throw new Error("Expected invalid input to be rejected.");
  } catch (error) {
    if (!(error instanceof HttpError) || error.code !== "VALIDATION") {
      throw error;
    }
    if (!error.fieldErrors?.some((item) => item.field === "schoolId")) {
      throw new Error("Expected a field-level schoolId validation error.");
    }
  }
});

Deno.test("JSON body validation rejects oversized request bodies", async () => {
  const request = new Request("https://edge.example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schoolId: "8e6c52e7-83f2-4a83-a5e5-35f7cccbde80" }),
  });

  try {
    await parseJsonBody(request, InputSchema, 8);
    throw new Error("Expected oversized input to be rejected.");
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 413) {
      throw error;
    }
  }
});
