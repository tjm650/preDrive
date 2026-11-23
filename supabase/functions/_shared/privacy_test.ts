import { assertEquals, assertFalse } from "jsr:@std/assert@1.0.14";
import {
  dataExportObjectPath,
  isValidDataExportObjectPath,
  isValidDeletionRequestId,
  utf8ByteLength,
} from "./privacy.ts";

Deno.test("data export object path is scoped to school and request", () => {
  assertEquals(
    dataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
      "c3333333-3333-4333-8333-333333333333",
    ),
    "a1111111-1111-4111-8111-111111111111/privacy/b2222222-2222-4222-8222-222222222222/c3333333-3333-4333-8333-333333333333.json",
  );
  assertEquals(
    dataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
      "d4444444-4444-4444-8444-444444444444",
    ) === dataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
      "c3333333-3333-4333-8333-333333333333",
    ),
    false,
  );
});

Deno.test("deletion request identifiers must be UUIDs", () => {
  assertEquals(
    isValidDeletionRequestId("b2222222-2222-4222-8222-222222222222"),
    true,
  );
  assertFalse(isValidDeletionRequestId("../private/export.json"));
  assertEquals(
    isValidDataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
      "a1111111-1111-4111-8111-111111111111/privacy/b2222222-2222-4222-8222-222222222222/c3333333-3333-4333-8333-333333333333.json",
    ),
    true,
  );
  assertFalse(
    isValidDataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
      "a1111111-1111-4111-8111-111111111111/privacy/b2222222-2222-4222-8222-222222222222/../private.json",
    ),
  );
  assertFalse(
    isValidDataExportObjectPath(
      "a1111111-1111-4111-8111-111111111111",
      "b2222222-2222-4222-8222-222222222222",
      "a1111111-1111-4111-8111-111111111111/privacy/b2222222-2222-4222-8222-222222222222/c3333333-3333-4333-8333-333333333333Xjson",
    ),
  );
  assertFalse(isValidDeletionRequestId("not-a-uuid"));
});

Deno.test("export size uses UTF-8 byte length", () => {
  assertEquals(utf8ByteLength("preDrive"), 8);
  assertEquals(utf8ByteLength("Moyo"), 4);
  assertEquals(utf8ByteLength("Shona: mwana"), 12);
});
