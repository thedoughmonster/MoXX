import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import Ajv from "ajv";

export async function assertContracts(evidence: {
  hold: Record<string, unknown>;
  order: Record<string, unknown>;
  status: Record<string, unknown>;
}): Promise<void> {
  const api = JSON.parse(await readFile(new URL(
    "../../contracts/preorder-public-v1.openapi.json",
    import.meta.url,
  ), "utf8"));
  const ajv = new Ajv({ strict: false, validateFormats: false });
  ajv.addSchema(api, "preorder");
  const validators = {
    hold: ajv.getSchema("preorder#/components/schemas/HoldResponse"),
    order: ajv.getSchema("preorder#/components/schemas/OrderIntentResponse"),
    status: ajv.getSchema("preorder#/components/schemas/OrderStatusResponse"),
  };
  assert.ok(validators.hold);
  assert.ok(validators.order);
  assert.ok(validators.status);
  const meta = (contract_key: string) => ({
    contract_key,
    request_id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
  });
  assert.equal(validators.hold({
    meta: meta("momi.preorder.checkout_hold.manage.v1"),
    ...evidence.hold,
  }), true, ajv.errorsText(validators.hold.errors));
  assert.equal(validators.order({
    meta: meta("momi.preorder.order_intent.create.v1"),
    ...evidence.order,
  }), true, ajv.errorsText(validators.order.errors));
  assert.equal(validators.status({
    meta: meta("momi.preorder.order_status.read.v1"),
    data: evidence.status,
  }), true, ajv.errorsText(validators.status.errors));
}
