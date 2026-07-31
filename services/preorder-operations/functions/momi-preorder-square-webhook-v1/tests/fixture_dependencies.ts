import type { WebhookDependencies } from "../src/types.ts"

const orderId = "10000000-0000-4000-8000-000000000001"
const attemptId = "20000000-0000-4000-8000-000000000002"
const evidence = {
  evidence_id: "square:webhook:test", source: "webhook" as const,
  disposition: "matched" as const, payment_status: "paid" as const,
  provider_payment_id: "square-payment",
  provider_updated_at: "2026-07-31T18:00:00Z", order_id: orderId,
  amount_minor: 2400, currency: "USD", location_id: "sandbox-location",
}

export function dependencies(calls: string[]): WebhookDependencies {
  return {
    getLocationId: () => "sandbox-location",
    authenticate: (raw) => {
      calls.push(`authenticate:${new TextDecoder().decode(raw)}`)
      return Promise.resolve({ disposition: "authenticated", evidence,
        error_code: null })
    },
    capture: (raw) => {
      calls.push(`capture:${raw}`)
      return Promise.resolve({ disposition: "stored", archiveItemId: "archive",
        contentHash: "a".repeat(64) })
    },
    resolve: () => { calls.push("resolve"); return Promise.resolve(attemptId) },
    project: () => { calls.push("project"); return Promise.resolve({
      disposition: "applied", receipt: {
        outcome: "accepted", order_id: orderId, order_version: 3,
        payment_attempt_id: attemptId, payment_status: "paid",
        amount: { currency: "USD", amount_minor: 2400 }, next_actions: ["view_status"],
      },
    }) },
  }
}
