import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { paymentFixture } from "./payment_fixture.ts";

export async function assertLateEvidenceAfterRelease(sql: Sql, windowId: string) {
  const created = await paymentFixture.order(sql, windowId);
  const orderId = String(created.order.order_id);
  const claimed = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId, expected_order_version: 1,
  }, created.authority);
  const attemptId = String((claimed.receipt as Record<string, unknown>)
    .payment_attempt_id);
  const claimId = String((claimed.claim as Record<string, unknown>).claim_id);
  const declined = await paymentFixture.project(sql, attemptId, claimId,
    paymentFixture.evidence({ evidenceId: "capacity-late-declined",
      source: "delivery", status: "declined", orderId,
      providerId: "capacity-late-payment",
      providerUpdatedAt: "2026-09-06T10:00:00.000Z" }));
  assert.equal(declined.disposition, "applied");
  await sql`update momi_preorder.orders set
    capacity_expires_at = clock_timestamp() - interval '1 second'
    where order_id = ${orderId}::uuid`;
  const [expired] = await sql`
    select momi_preorder.expire_abandoned_orders_v1() as count`;
  assert.equal(expired.count, 1);
  const [before] = await sql`
    select committed_quantity from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  const latePaid = paymentFixture.evidence({ evidenceId: "capacity-late-paid",
    source: "webhook", status: "paid", orderId,
    providerId: "capacity-late-payment",
    providerUpdatedAt: "2026-09-06T10:01:00.000Z" });
  const projected = await paymentFixture.project(sql, attemptId, null, latePaid);
  assert.equal(projected.disposition, "conflict");
  const duplicate = await paymentFixture.project(sql, attemptId, null, latePaid);
  assert.equal(duplicate.disposition, "duplicate");
  const [replay] = await sql`
    select momi_preorder.expire_abandoned_orders_v1() as count`;
  assert.equal(replay.count, 0);
  const [order] = await sql`
    select order_status, capacity_released_at is not null as released,
      fulfillment_window_id::text as window_id
    from momi_preorder.orders where order_id = ${orderId}::uuid`;
  assert.deepEqual(order, { order_status: "attention_required", released: true,
    window_id: windowId });
  const [after] = await sql`
    select committed_quantity from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  assert.deepEqual(after, before);
}
