import type { PaymentEvidence, PaymentProjection } from
  "../../../src/payment_types.ts"
import { getDatabase } from "./database.ts"

export async function projectPayment(
  paymentAttemptId: string,
  claimId: string,
  evidence: PaymentEvidence,
): Promise<PaymentProjection> {
  const sql = getDatabase()
  const rows = await sql<{ result: PaymentProjection }[]>`
    select momi_preorder.project_payment_evidence_v1(
      ${paymentAttemptId}::uuid,
      ${claimId}::uuid,
      ${sql.json(evidence)}::jsonb
    ) as result
  `
  if (!rows[0]?.result) throw new Error("payment_projection_failed")
  return rows[0].result
}
