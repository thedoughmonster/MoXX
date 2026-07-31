import assert from "node:assert/strict"
import test from "node:test"

import { buildReconciliationEvidence } from "../src/build_reconciliation_evidence.ts"

test("builds deterministic sanitized reconciliation evidence", async () => {
  const observation = {
    disposition: "matched" as const,
    providerPaymentId: "sandbox-payment",
    providerUpdatedAt: "2026-07-31T15:30:00Z",
    providerStatus: "COMPLETED",
    providerRequestId: "sandbox-request",
    paymentStatus: "paid" as const,
    orderId: "70000000-0000-4000-8000-000000000273",
    amountMinor: 2400, currency: "USD", locationId: "sandbox-location",
    errorCode: null,
  }
  const first = await buildReconciliationEvidence(observation)
  const replay = await buildReconciliationEvidence(observation)

  assert.deepEqual(first, replay)
  assert.equal(first.source, "reconciliation")
  assert.equal(first.disposition, "matched")
  assert.equal(first.provider_payment_id, observation.providerPaymentId)
  assert.equal(first.provider_updated_at, observation.providerUpdatedAt)
  assert.equal(first.evidence_id.startsWith("square:reconciliation:sha256:"), true)
  assert.equal("providerRequestId" in first, false)
})
