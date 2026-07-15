import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractPaymentGuids } from "../src/extract_payment_guids.ts";
import { extractResponseResources } from "../src/extract_resources.ts";
import { makeFixture } from "./test_fixture.ts";

const migration = (name: string) =>
  readFile(
    new URL(
      `../../../../../supabase/migrations/${name}`,
      import.meta.url,
    ),
    "utf8",
  );

test("scheduled payment list GUIDs are identified for detail hydration", () => {
  const { operation } = makeFixture();
  const payments = {
    ...operation,
    operation_key: "toast.payments.list.v1",
    resource_type: "payment",
    pagination_kind: "none" as const,
  };
  const guid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const payloads = extractResponseResources([guid], payments, 200);
  assert.deepEqual(extractPaymentGuids(payments, payloads), [guid]);
  assert.deepEqual(extractPaymentGuids(operation, payloads), []);
  assert.throws(
    () => extractPaymentGuids(payments, [{ value: 42 }]),
    /not a GUID/,
  );
  assert.throws(
    () => extractPaymentGuids(payments, [{ value: "not-a-guid" }]),
    /not a GUID/,
  );
});

test("payment detail work is durable, registered, and idempotent", async () => {
  const source = await migration(
    "20260715055915_enqueue_toast_payment_details.sql",
  );
  assert.match(source, /operation_key = 'toast\.payments\.get\.v1'/);
  assert.match(source, /source_operation_id = 'paymentsGuidGet'/);
  assert.match(source, /parameter\.parameter_key = 'guid'/);
  assert.match(
    source,
    /operation\.exact_resource_only and operation\.is_enabled/,
  );
  assert.match(source, /'toast\.payment\.detail:' \|\| parent\.job_id/);
  assert.match(source, /on conflict \(idempotency_key\) do nothing/);
});

test("payment fanout happens after archive persistence and before completion", async () => {
  const source = await readFile(
    new URL("../src/process_page.ts", import.meta.url),
    "utf8",
  );
  const persisted = source.indexOf("persistResourceObservations(");
  const enqueued = source.indexOf("enqueuePaymentDetails(job, paymentGuids)");
  const completed = source.indexOf("return finalizePage", enqueued);
  assert.ok(persisted >= 0 && enqueued > persisted && completed > enqueued);
  assert.match(source, /toast_payment_detail_enqueue_failed/);
});
