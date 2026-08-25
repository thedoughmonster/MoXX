import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import Ajv from "ajv";

test("reconciliation status requires a durable payment attempt", async () => {
  const api = JSON.parse(await readFile(new URL(
    "../contracts/preorder-public-v1.openapi.json",
    import.meta.url,
  ), "utf8"));
  const ajv = new Ajv({ strict: false, validateFormats: false });
  ajv.addSchema(api, "preorder");
  const validate = ajv.getSchema(
    "preorder#/components/schemas/OrderStatusResponse",
  );
  assert.ok(validate);
  const response = {
    meta: {
      contract_key: "momi.preorder.order_status.read.v1",
      request_id: "30000000-0000-4000-8000-000000000301",
      generated_at: "2026-08-01T18:00:00Z",
    },
    data: {
      order_id: "30000000-0000-4000-8000-000000000302",
      order_version: 2,
      order_status: "attention_required",
      payment_attempt_id: null as string | null,
      payment_status: "indeterminate",
      fulfillment_status: "not_scheduled",
      fulfillment_window: {
        window_id: "30000000-0000-4000-8000-000000000303",
        date: "2026-08-05",
        starts_at: "2026-08-05T12:00:00Z",
        ends_at: "2026-08-05T14:00:00Z",
        order_cutoff_at: "2026-08-04T12:00:00Z",
        availability: "available",
      },
      total: { currency: "USD", amount_minor: 1000 },
      allowed_actions: [
        "view_status", "reconcile_payment", "contact_shop",
      ],
      policy_summary: "Accepted terms remain frozen for this order.",
      updated_at: "2026-08-01T18:00:00Z",
    },
  };
  assert.equal(validate(response), false);
  response.data.payment_attempt_id =
    "30000000-0000-4000-8000-000000000304";
  assert.equal(validate(response), true, ajv.errorsText(validate.errors));
});
