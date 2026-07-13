import { sql } from "./database.ts"
import type {
  ClaimedWork,
  DecisionOutcome,
  OrderApiResponse,
  OrderApiSuccess,
} from "./types.ts"

export async function completeWork(
  job: ClaimedWork,
  response: OrderApiResponse,
  order: OrderApiSuccess,
): Promise<DecisionOutcome> {
  const metadata = {
    contract_key: order.contract_key,
    contract_version: order.contract_version,
    trace_id: order.trace_id,
    source_system: order.source_system,
    source_version_id: order.source_version_id,
    location_id: order.location_id,
    order_id: order.order_id,
    response_headers: response.response_headers,
  }
  const rows = await sql<DecisionOutcome[]>`
    with decision as (
      select *
      from momi_alerting.claim_order_alert_candidates(
        ${job.work_id}::bigint,
        ${sql.json(order.payload)},
        ${sql.json(order.order_presentation)}
      )
    ), attempt_update as (
      update momi_orders.api_invocation_attempts as attempt
      set finished_at = now(),
          outcome = 'succeeded',
          http_status = ${response.status},
          response_metadata = ${sql.json(metadata)},
          decision_outcome = to_jsonb(decision)
      from decision
      where attempt.id = ${job.attempt_id}::bigint
      returning attempt.work_id, to_jsonb(decision) as outcome
    ), work_update as (
      update momi_orders.api_invocation_work as work
      set status = 'succeeded',
          lease_expires_at = null,
          completed_at = now(),
          last_error = null,
          last_outcome = attempt_update.outcome
      from attempt_update
      where work.id = attempt_update.work_id
    )
    select
      work_found,
      order_matches,
      matched_count,
      ambiguous_count,
      claimed_count,
      candidate_ids
    from decision
  `
  if (rows.length !== 1) throw new Error("Alert decision was not persisted")
  return rows[0]
}
