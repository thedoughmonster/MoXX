import { getDatabase } from "./database.ts"
import type {
  InitiateClaimExecution,
  PaymentInitiateClaimInput,
} from "./types.ts"
import { functionKey } from "./types.ts"

export async function claimPayment(
  input: PaymentInitiateClaimInput,
  authority: string,
  locationId: string,
): Promise<InitiateClaimExecution> {
  const sql = getDatabase()
  const rows = await sql<InitiateClaimExecution[]>`
    with admission as (
      select momi_preorder.admit_public_request_v1(
        ${functionKey}, ${authority}
      ) as admitted
    )
    select admission.admitted,
      case when admission.admitted then
        momi_preorder.claim_payment_attempt_v1(
          ${sql.json(input)}::jsonb, ${authority}, ${locationId}
        )
      else null end as result
    from admission
  `
  return rows[0] ?? { admitted: false, result: null }
}
