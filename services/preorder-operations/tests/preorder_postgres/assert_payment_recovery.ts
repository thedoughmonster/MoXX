import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaymentRecovery(sql: Sql, windowId: string) {
  const created = await paymentFixture.order(sql, windowId);
  const orderId = String(created.order.order_id);
  const commandId = crypto.randomUUID();
  const request = { command_id: commandId, order_id: orderId,
    expected_order_version: 1 };
  const claimed = await paymentFixture.claim(sql, request, created.authority);
  const attemptId = String(
    (claimed.receipt as Record<string, unknown>).payment_attempt_id);
  await sql`update momi_preorder.payment_attempts set
    claim_expires_at = clock_timestamp() - interval '1 second'
    where payment_attempt_id = ${attemptId}::uuid`;
  const replay = await paymentFixture.claim(sql, request, created.authority);
  assert.equal(replay.disposition, "replay");
  assert.equal((replay.receipt as Record<string, unknown>).payment_status,
    "indeterminate");
  assert.equal(replay.claim, null);
  const [pendingStatus] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(
      ${orderId}::uuid, ${created.authority}) as data`;
  assert.equal(pendingStatus?.data.payment_attempt_id, attemptId);
  assert.deepEqual(pendingStatus?.data.allowed_actions, [
    "view_status", "reconcile_payment", "contact_shop",
  ]);
  const reconcile = await paymentFixture.reconcile(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 3, payment_attempt_id: attemptId,
  }, created.authority);
  assert.equal(reconcile.disposition, "operator_review");
  assert.equal(reconcile.claim, null);
  const [count] = await sql<{ count: number }[]>`
    select count(*)::integer as count from momi_preorder.payment_attempts
    where order_id = ${orderId}::uuid`;
  assert.equal(count?.count, 1);

  const declinedOrder = await paymentFixture.order(sql, windowId);
  const declinedOrderId = String(declinedOrder.order.order_id);
  const declinedClaim = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: declinedOrderId,
    expected_order_version: 1,
  }, declinedOrder.authority);
  const declinedReceipt = declinedClaim.receipt as Record<string, unknown>;
  const decline = await paymentFixture.project(sql,
    String(declinedReceipt.payment_attempt_id),
    String((declinedClaim.claim as Record<string, unknown>).claim_id),
    paymentFixture.evidence({
      evidenceId: "delivery-declined-1", source: "delivery",
      status: "declined", orderId: declinedOrderId,
      providerId: "square-payment-declined-1",
    }));
  assert.equal((decline.receipt as Record<string, unknown>).outcome, "rejected");
  assert.deepEqual((decline.receipt as Record<string, unknown>).next_actions,
    ["view_status", "retry_payment"]);
  const [declinedStatus] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(
      ${declinedOrderId}::uuid, ${declinedOrder.authority}) as data`;
  assert.equal(declinedStatus?.data.payment_attempt_id,
    declinedReceipt.payment_attempt_id);
  assert.ok((declinedStatus?.data.allowed_actions as string[]).includes(
    "retry_payment"));
  const retry = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: declinedOrderId,
    expected_order_version: 3,
  }, declinedOrder.authority);
  assert.equal(retry.disposition, "claimed");
  assert.notEqual((retry.receipt as Record<string, unknown>).payment_attempt_id,
    declinedReceipt.payment_attempt_id);
  const [retryStatus] = await sql<{ data: Record<string, unknown> }[]>`
    select momi_preorder.read_order_status_v1(
      ${declinedOrderId}::uuid, ${declinedOrder.authority}) as data`;
  assert.equal(retryStatus?.data.payment_attempt_id,
    (retry.receipt as Record<string, unknown>).payment_attempt_id);
}
