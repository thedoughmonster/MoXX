import { sql } from "./database.ts"
import type { DeliveryTrigger } from "./delivery_types.ts"
import { exactOrderContractKey, latestOrderContractKey } from "./types.ts"
import type { CanonicalReadCapability, ClaimedWork } from "./types.ts"

type IssuedReadCapability = Omit<CanonicalReadCapability, "contract_key">

export async function issueOrderReadCapability(
  job: ClaimedWork,
  delivery: DeliveryTrigger,
): Promise<CanonicalReadCapability> {
  if (job.api_contract_key !== exactOrderContractKey &&
    job.api_contract_key !== latestOrderContractKey) {
    throw new Error("Read capability contract is not canonical")
  }
  const rows = await sql<IssuedReadCapability[]>`
    select read_work_id as work_id, capability_token::text
    from momi_alerting.issue_order_read_capability(
      ${job.work_id}::bigint,
      ${job.attempt_id}::bigint,
      ${job.invocation_id}::uuid,
      ${delivery.event_id}::uuid,
      ${delivery.message_id}::bigint,
      ${delivery.capability_token}::uuid
    )
  `
  if (rows.length !== 1) {
    throw new Error("Canonical read capability was not issued")
  }
  return { ...rows[0], contract_key: job.api_contract_key }
}
