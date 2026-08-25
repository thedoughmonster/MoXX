import { sql } from "./database.ts"
import { contractVersion, type StockReadContract,
  type StockReadInput, type StockReadRow } from "./types.ts"

export async function readStock(
  input: StockReadInput,
  contract: StockReadContract,
): Promise<StockReadRow> {
  const rows = await sql<StockReadRow[]>`
    with authorized_work as (
      select momi_api.consume_read_capability(
        ${input.work_id}::bigint,
        ${contract.functionKey},
        ${input.item_id}::uuid,
        ${input.location_id}::uuid,
        ${input.capability_token}::uuid
      ) as work_id
    ), active_contract as (
      select true as active from momi_api.read_view_registry
      where view_key = ${contract.functionKey}
        and contract_version = ${contractVersion}
        and schema_name = 'momi_api'
        and view_or_function_name = ${contract.viewName}
        and active
    )
    select work.work_id,
      coalesce(contract.active, false) as contract_active,
      record.item_entity_id::text as item_id,
      record.location_entity_id::text as location_id,
      record.observed_at, record.stock_state, record.quantity::text,
      record.provenance, record.freshness
    from (values (true)) as request(present)
    left join authorized_work as work on true
    left join active_contract as contract on true
    left join momi_api.stock_observations_latest_v1 as record
      on work.work_id is not null and contract.active
      and record.item_entity_id = ${input.item_id}::uuid
      and record.location_entity_id = ${input.location_id}::uuid
    limit 1
  `
  return rows[0] ?? { work_id: null, contract_active: false,
    item_id: null, location_id: null, observed_at: null, stock_state: null,
    quantity: null, provenance: null, freshness: null }
}
