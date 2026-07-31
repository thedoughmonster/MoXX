import type { PaymentEvidence } from "../../../src/payment_types.ts"
import { getDatabase } from "./database.ts"

export async function resolvePayment(
  evidence: PaymentEvidence,
): Promise<string | null> {
  const sql = getDatabase()
  const rows = await sql<{ payment_attempt_id: string | null }[]>`
    select momi_preorder.resolve_payment_attempt_v1(
      ${evidence.provider_payment_id}, ${evidence.order_id}::uuid,
      ${evidence.amount_minor}, ${evidence.currency}, ${evidence.location_id}
    )::text as payment_attempt_id
  `
  return rows[0]?.payment_attempt_id ?? null
}
