import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";

import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaymentContracts(evidence: {
  envelope: Record<string, unknown>;
  receipt: Record<string, unknown>;
}) {
  const read = async (name: string) => JSON.parse(await readFile(
    new URL(`../../contracts/${name}`, import.meta.url), "utf8"));
  const [claimSchema, evidenceSchema, api] = await Promise.all([
    read("payment-attempt-claim-v1.schema.json"),
    read("payment-financial-evidence-v1.schema.json"),
    read("preorder-public-v1.openapi.json"),
  ]);
  const modern = new Ajv2020({ strict: false, validateFormats: false });
  assert.equal(modern.validate(claimSchema, evidence.envelope), true,
    modern.errorsText());
  const example = paymentFixture.evidence({ evidenceId: "contract-evidence-1",
    source: "webhook", status: "paid",
    orderId: String(evidence.receipt.order_id) });
  assert.equal(modern.validate(evidenceSchema, example), true,
    modern.errorsText());
  const openApi = new Ajv({ strict: false, validateFormats: false });
  openApi.addSchema(api, "preorder");
  const validate = openApi.getSchema(
    "preorder#/components/schemas/PaymentResponse");
  assert.ok(validate);
  assert.equal(validate({
    meta: { contract_key: "momi.preorder.payment.initiate.v1",
      request_id: crypto.randomUUID(), generated_at: new Date().toISOString() },
    ...evidence.receipt,
  }), true, openApi.errorsText(validate.errors));
}
