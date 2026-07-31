import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

test("freezes payment lifecycle and internal integration contracts", async () => {
  const read = async (name: string) => JSON.parse(await readFile(
    new URL(`../contracts/${name}`, import.meta.url), "utf8"));
  const [claimSchema, resolveSchema, evidenceSchema, lifecycle, api] =
    await Promise.all([
      read("payment-attempt-claim-v1.schema.json"),
      read("payment-attempt-resolve-v1.schema.json"),
      read("payment-financial-evidence-v1.schema.json"),
      read("payment-lifecycle-v1.json"),
      read("preorder-public-v1.openapi.json"),
    ]);
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  assert.equal(ajv.validateSchema(claimSchema), true, ajv.errorsText());
  assert.equal(ajv.validateSchema(resolveSchema), true, ajv.errorsText());
  assert.equal(ajv.validateSchema(evidenceSchema), true, ajv.errorsText());
  const statuses = ["pending", "authorized", "paid", "declined", "canceled",
    "refund_pending", "refunded", "indeterminate"];
  assert.deepEqual(Object.keys(lifecycle.transitions), statuses);
  assert.deepEqual(Object.keys(lifecycle.order_projection), statuses);
  assert.deepEqual(Object.keys(lifecycle.recovery_actions), statuses);
  assert.deepEqual(lifecycle.privacy, {
    persist_source_token: false,
    persist_raw_provider_payload: false,
    persist_customer_contact_in_payment_tables: false,
  });
  assert.ok(api.paths["/momi-preorder-payment-initiate-v1"]);
  assert.ok(api.paths["/momi-preorder-payment-reconcile-v1"]);
  assert.equal(JSON.stringify(claimSchema).includes("source_token"), false);
  assert.equal(JSON.stringify(evidenceSchema).includes("source_token"), false);
});
