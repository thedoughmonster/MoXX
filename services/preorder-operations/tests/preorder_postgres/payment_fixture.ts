import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { lifecycleFixture } from "./fixture.ts";

export const paymentLocationId = "sandbox-location-logic-test";

export const paymentFixture = {
  async order(sql: Sql, windowId: string) {
    const quote = await lifecycleFixture.quote(sql, windowId);
    const order = await lifecycleFixture.order(sql, quote.authority, {
      command_id: crypto.randomUUID(), quote_id: quote.quoteId,
      expected_quote_version: 1,
      contact: { name: "Payment Test", email: "payment@example.test" },
    });
    assert.equal(order.outcome, "accepted");
    return { order, authority: String(order.recovery_authority) };
  },
  async claim(
    sql: Sql,
    request: Record<string, unknown>,
    authority: string,
    locationId = paymentLocationId,
  ) {
    const [row] = await sql<{ result: Record<string, unknown> }[]>`
      select momi_preorder.claim_payment_attempt_v1(
        ${sql.json(request)}::jsonb, ${authority}, ${locationId}) as result`;
    assert.ok(row);
    return row.result;
  },
  async reconcile(
    sql: Sql,
    request: Record<string, unknown>,
    authority: string,
    locationId = paymentLocationId,
  ) {
    const [row] = await sql<{ result: Record<string, unknown> }[]>`
      select momi_preorder.claim_payment_reconciliation_v1(
        ${sql.json(request)}::jsonb, ${authority}, ${locationId}) as result`;
    assert.ok(row);
    return row.result;
  },
  async project(
    sql: Sql,
    attemptId: string,
    claimId: string | null,
    evidence: Record<string, unknown>,
  ) {
    const [row] = await sql<{ result: Record<string, unknown> }[]>`
      select momi_preorder.project_payment_evidence_v1(
        ${attemptId}::uuid, ${claimId}::uuid,
        ${sql.json(evidence)}::jsonb) as result`;
    assert.ok(row);
    return row.result;
  },
  evidence(input: {
    evidenceId: string;
    source: "delivery" | "reconciliation" | "webhook";
    status: string;
    orderId: string;
    providerId?: string;
    providerUpdatedAt?: string;
    amountMinor?: number;
  }) {
    return {
      evidence_id: input.evidenceId,
      source: input.source,
      disposition: "matched",
      payment_status: input.status,
      provider_payment_id: input.providerId ?? "square-payment-test-1",
      provider_updated_at: input.providerUpdatedAt ?? new Date().toISOString(),
      order_id: input.orderId,
      amount_minor: input.amountMinor ?? 280,
      currency: "USD",
      location_id: paymentLocationId,
    };
  },
};
