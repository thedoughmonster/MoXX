import { sql } from "./database.ts"
import { contractVersion, functionKey,
  type OrderReadInput, type OrderReadRow } from "./types.ts"

export async function readOrder(input: OrderReadInput): Promise<OrderReadRow> {
  const rows = await sql<OrderReadRow[]>`
    with authorized_work as (
      select momi_api.consume_read_capability(
        ${input.work_id}::bigint,
        ${functionKey},
        ${input.order_id}::uuid,
        null,
        ${input.capability_token}::uuid
      ) as work_id
    ), active_contract as (
      select true as active from momi_api.read_view_registry
      where view_key = ${functionKey}
        and contract_version = ${contractVersion}
        and schema_name = 'momi_api'
        and view_or_function_name = 'orders_by_id_v1'
        and active
    )
    select work.work_id,
      coalesce(contract.active, false) as contract_active,
      order_record.order_id::text,
      order_record.schema_version,
      order_record.order_document,
      order_record.order_presentation,
      order_record.provenance,
      order_record.freshness
    from (values (true)) as request(present)
    left join authorized_work as work on true
    left join active_contract as contract on true
    left join momi_api.orders_by_id_v1 as order_record
      on work.work_id is not null and contract.active
      and order_record.order_id = ${input.order_id}::uuid
    limit 1
  `
  return rows[0] ?? { work_id: null, contract_active: false,
    order_id: null, schema_version: null, order_document: null,
    order_presentation: null, provenance: null, freshness: null }
}
