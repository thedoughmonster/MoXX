import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaymentMismatch(sql: Sql, windowId: string) {
  const created = await paymentFixture.order(sql, windowId);
  const orderId = String(created.order.order_id);
  const claimed = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 1,
  }, created.authority);
  const claim = claimed.claim as Record<string, unknown>;
  const receipt = claimed.receipt as Record<string, unknown>;
  const mismatch = await paymentFixture.project(
    sql, String(receipt.payment_attempt_id), String(claim.claim_id),
    { ...paymentFixture.evidence({
      evidenceId: "delivery-money-mismatch", source: "delivery",
      status: "paid", orderId, amountMinor: 281,
    }), order_id: crypto.randomUUID(), currency: "EUR",
      location_id: "different-square-location" },
  );
  assert.equal(mismatch.disposition, "mismatch");
  assert.equal((mismatch.receipt as Record<string, unknown>).payment_status,
    "indeterminate");
  const [order] = await sql<{ order_status: string; payment_status: string }[]>`
    select order_status, payment_status from momi_preorder.orders
    where order_id = ${orderId}::uuid`;
  assert.deepEqual(order, {
    order_status: "attention_required", payment_status: "indeterminate",
  });
  const wrongAuthority = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 3,
  }, `wrong-${crypto.randomUUID()}`);
  assert.equal((wrongAuthority.error as Record<string, unknown>)?.code,
    "not_authorized");
}
