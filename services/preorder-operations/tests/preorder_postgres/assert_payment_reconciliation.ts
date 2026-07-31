import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { paymentFixture } from "./payment_fixture.ts";

export async function assertPaymentReconciliation(sql: Sql, windowId: string) {
  const created = await paymentFixture.order(sql, windowId);
  const orderId = String(created.order.order_id);
  const claimed = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 1,
  }, created.authority);
  const claim = claimed.claim as Record<string, unknown>;
  const receipt = claimed.receipt as Record<string, unknown>;
  const attemptId = String(receipt.payment_attempt_id);
  const pending = await paymentFixture.project(sql, attemptId,
    String(claim.claim_id), paymentFixture.evidence({
      evidenceId: "delivery-pending-1", source: "delivery", status: "pending",
      orderId, providerId: "square-payment-ordering-1",
      providerUpdatedAt: "2026-07-31T13:10:00.000Z",
    }));
  assert.equal(pending.disposition, "applied");
  const reconcile = await paymentFixture.reconcile(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: 3, payment_attempt_id: attemptId,
  }, created.authority);
  assert.equal(reconcile.disposition, "claimed");
  const reconcileClaim = reconcile.claim as Record<string, unknown>;
  assert.equal(reconcileClaim.provider_payment_id, "square-payment-ordering-1");
  const webhookEvidence = paymentFixture.evidence({
    evidenceId: "webhook-paid-1", source: "webhook", status: "paid", orderId,
    providerId: "square-payment-ordering-1",
    providerUpdatedAt: "2026-07-31T13:12:00.000Z",
  });
  const webhookResults = await Promise.all([
    paymentFixture.project(sql, attemptId, null, webhookEvidence),
    paymentFixture.project(sql, attemptId, null, webhookEvidence),
  ]);
  assert.deepEqual(webhookResults.map((result) => result.disposition).sort(),
    ["applied", "duplicate"]);
  const webhook = webhookResults.find((result) =>
    result.disposition === "applied") as Record<string, unknown>;
  assert.equal((webhook.receipt as Record<string, unknown>).payment_status, "paid");
  const stale = await paymentFixture.project(sql, attemptId,
    String(reconcileClaim.claim_id), paymentFixture.evidence({
      evidenceId: "reconcile-pending-stale", source: "reconciliation",
      status: "pending", orderId, providerId: "square-payment-ordering-1",
      providerUpdatedAt: "2026-07-31T13:11:00.000Z",
    }));
  assert.equal(stale.disposition, "stale");
  assert.equal((stale.receipt as Record<string, unknown>).payment_status, "paid");
  const collision = await paymentFixture.project(sql, attemptId, null, {
    ...webhookEvidence, payment_status: "declined",
  });
  assert.equal(collision.disposition, "conflict");
  assert.equal((collision.receipt as Record<string, unknown>).payment_status, "paid");
}
