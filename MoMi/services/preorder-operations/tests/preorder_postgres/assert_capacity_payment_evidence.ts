import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaidAttemptProtectsCapacity(
  sql: Sql,
  windowId: string,
): Promise<void> {
  const created = await paymentFixture.order(sql, windowId);
  const orderId = String(created.order.order_id);
  const firstClaim = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 1,
  }, created.authority);
  const firstReceipt = firstClaim.receipt as Record<string, unknown>;
  const firstAttemptId = String(firstReceipt.payment_attempt_id);
  const firstClaimId = String(
    (firstClaim.claim as Record<string, unknown>).claim_id);
  const declined = await paymentFixture.project(sql, firstAttemptId,
    firstClaimId, paymentFixture.evidence({
      evidenceId: "capacity-first-declined", source: "delivery",
      status: "declined", orderId,
      providerId: "capacity-payment-declined",
      providerUpdatedAt: "2026-09-06T09:00:00.000Z",
    }));
  const retry = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version:
      (declined.receipt as Record<string, unknown>).order_version,
  }, created.authority);
  const retryReceipt = retry.receipt as Record<string, unknown>;
  const paid = await paymentFixture.project(sql,
    String(retryReceipt.payment_attempt_id),
    String((retry.claim as Record<string, unknown>).claim_id),
    paymentFixture.evidence({
      evidenceId: "capacity-retry-paid", source: "delivery", status: "paid",
      orderId, providerId: "capacity-payment-paid",
      providerUpdatedAt: "2026-09-06T09:01:00.000Z",
    }));
  assert.equal(paid.disposition, "applied");
  const regressed = await paymentFixture.project(sql, firstAttemptId, null,
    paymentFixture.evidence({
      evidenceId: "capacity-first-declined-newer", source: "webhook",
      status: "declined", orderId,
      providerId: "capacity-payment-declined",
      providerUpdatedAt: "2026-09-06T09:02:00.000Z",
    }));
  assert.equal(regressed.disposition, "applied");
  assert.equal((regressed.receipt as Record<string, unknown>).payment_status,
    "declined");

  await sql`update momi_preorder.orders set
    capacity_expires_at = clock_timestamp() - interval '1 second'
    where order_id = ${orderId}::uuid`;
  const [before] = await sql<{ committed: number }[]>`
    select committed_quantity as committed
    from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  const [expired] = await sql<{ count: number }[]>`
    select momi_preorder.expire_abandoned_orders_v1() as count`;
  const [after] = await sql<{ committed: number }[]>`
    select committed_quantity as committed
    from momi_preorder.fulfillment_windows
    where window_id = ${windowId}::uuid`;
  const [order] = await sql<{ status: string; released: boolean }[]>`
    select order_status as status, capacity_released_at is not null as released
    from momi_preorder.orders where order_id = ${orderId}::uuid`;
  assert.equal(expired.count, 0);
  assert.equal(after.committed, before.committed);
  assert.deepEqual(order, { status: "awaiting_payment", released: false });
}
