import { assertEquals, assertFalse } from "jsr:@std/assert@1.0.14";
import {
  dataExportObjectPath,
  isValidDeletionRequestId,
  utf8ByteLength,
} from "./privacy.ts";

Deno.test("data export object path is scoped to school and request", () => {
  assertEquals(
    dataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
    ),
    "a1111111-1111-4111-8111-111111111111/privacy/b2222222-2222-4222-8222-222222222222.json",
  );
});

Deno.test("deletion request identifiers must be UUIDs", () => {
  assertEquals(
    isValidDeletionRequestId("b2222222-2222-4222-8222-222222222222"),
    true,
  );
  assertFalse(isValidDeletionRequestId("../private/export.json"));
  assertFalse(isValidDeletionRequestId("not-a-uuid"));
});

Deno.test("export size uses UTF-8 byte length", () => {
  assertEquals(utf8ByteLength("preDrive"), 8);
  assertEquals(utf8ByteLength("Moyo"), 4);
  assertEquals(utf8ByteLength("Shona: mwana"), 12);
});
