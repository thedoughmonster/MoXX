import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { paymentFixture, paymentLocationId } from "./payment_fixture.ts";

export async function assertPaymentProjection(
  sql: Sql,
  evidence: { authority: string; claim: Record<string, unknown>;
    receipt: Record<string, unknown> },
) {
  const attemptId = String(evidence.receipt.payment_attempt_id);
  const orderId = String(evidence.receipt.order_id);
  const claimId = String(evidence.claim.claim_id);
  const paidEvidence = paymentFixture.evidence({
    evidenceId: "delivery-paid-1", source: "delivery", status: "paid",
    orderId, providerId: "square-payment-paid-1",
    providerUpdatedAt: "2026-07-31T13:00:00.000Z",
  });
  const applied = await paymentFixture.project(
    sql, attemptId, claimId, paidEvidence);
  assert.equal(applied.disposition, "applied");
  const receipt = applied.receipt as Record<string, unknown>;
  assert.equal(receipt.payment_status, "paid");
  assert.equal(receipt.outcome, "accepted");
  assert.deepEqual(receipt.next_actions, ["view_status"]);
  const duplicate = await paymentFixture.project(
    sql, attemptId, claimId, paidEvidence);
  assert.equal(duplicate.disposition, "duplicate");
  assert.equal((duplicate.receipt as Record<string, unknown>).order_version,
    receipt.order_version);
  const terminal = await paymentFixture.claim(sql, {
    command_id: crypto.randomUUID(), order_id: orderId,
    expected_order_version: receipt.order_version,
  }, evidence.authority, paymentLocationId);
  assert.equal(terminal.disposition, "already_terminal");

  const refundPending = await paymentFixture.project(sql, attemptId, null,
    paymentFixture.evidence({
      evidenceId: "webhook-refund-pending-1", source: "webhook",
      status: "refund_pending", orderId,
      providerId: "square-payment-paid-1",
      providerUpdatedAt: "2026-07-31T13:01:00.000Z",
    }));
  assert.equal(refundPending.disposition, "applied");
  assert.equal((refundPending.receipt as Record<string, unknown>).payment_status,
    "refund_pending");
  const refunded = await paymentFixture.project(sql, attemptId, null,
    paymentFixture.evidence({
      evidenceId: "webhook-refunded-1", source: "webhook", status: "refunded",
      orderId, providerId: "square-payment-paid-1",
      providerUpdatedAt: "2026-07-31T13:02:00.000Z",
    }));
  assert.equal(refunded.disposition, "applied");
  assert.equal((refunded.receipt as Record<string, unknown>).outcome, "accepted");
  assert.deepEqual((refunded.receipt as Record<string, unknown>).next_actions,
    ["view_status", "contact_shop"]);

  const [terms] = await sql<{ accepted_terms: Record<string, unknown>;
    accepted_terms_digest: string }[]>`
    select accepted_terms, accepted_terms_digest
    from momi_preorder.payment_attempts
    where payment_attempt_id = ${attemptId}::uuid`;
  assert.equal((terms?.accepted_terms.accepted_policy as Record<string, unknown>)
    ?.summary, "Changes are accepted before fulfillment begins.");
  assert.match(terms?.accepted_terms_digest ?? "", /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(terms?.accepted_terms).includes("payment@example.test"),
    false);
  return { attemptId, orderId, authority: evidence.authority };
}
