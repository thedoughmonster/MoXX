import { sql } from "./database.ts"
import {
  contractVersion,
  functionKey,
  registeredSchemaName,
  registeredViewName,
  sourceSystem,
  type OrderLookup,
  type OrderReadInput,
  type OrderReadRow,
} from "./types.ts"

export async function readOrder(input: OrderReadInput): Promise<OrderLookup> {
  const rows = await sql<OrderReadRow[]>`
    with authorized_work as (
      select
        work.id::text as work_id,
        work.source_version_id as work_source_version_id,
        work.source_system,
        work.location_id
      from momi_orders.api_invocation_work as work
      where work.id = ${input.work_id}::bigint
        and work.order_id = ${input.order_id}
        and work.trigger_token = ${input.trigger_token}::uuid
        and work.source_system = ${sourceSystem}
        and work.api_contract_key = ${functionKey}
        and work.status = 'running'
    ), active_contract as (
      select true as contract_active
      from momi_api.read_view_registry as registry
      where registry.view_key = ${functionKey}
        and registry.contract_version = ${contractVersion}
        and registry.schema_name = ${registeredSchemaName}
        and registry.view_or_function_name = ${registeredViewName}
        and registry.active
    )
    select
      work.work_id,
      work.work_source_version_id,
      coalesce(contract.contract_active, false) as contract_active,
      order_record.source_system,
      order_record.source_version_id,
      order_record.order_id,
      order_record.location_id,
      to_jsonb(order_record.retrieved_at) #>> '{}' as retrieved_at,
      order_record.content_hash,
      order_record.payload,
      order_record.order_presentation
    from (values (true)) as request_marker(present)
    left join authorized_work as work on true
    left join active_contract as contract on true
    left join lateral (
      select order_view.*
      from momi_api.toast_orders_by_id_v1 as order_view
      where work.work_id is not null
        and contract.contract_active
        and order_view.source_system = work.source_system
        and order_view.source_version_id = work.work_source_version_id
        and order_view.order_id = ${input.order_id}
        and order_view.location_id = work.location_id
      limit 1
    ) as order_record on true
  `

  const row = rows[0]
  if (!row || row.work_id === null || row.work_source_version_id === null) {
    return { disposition: "forbidden" }
  }
  if (!row.contract_active) {
    return {
      disposition: "contract_inactive",
      work_source_version_id: row.work_source_version_id,
    }
  }
  if (
    row.source_system === null || row.source_version_id === null ||
    row.order_id === null || row.location_id === null ||
    row.retrieved_at === null ||
    row.content_hash === null || row.payload === null ||
    row.order_presentation === null
  ) {
    return {
      disposition: "order_not_found",
      work_source_version_id: row.work_source_version_id,
    }
  }

  return {
    disposition: "found",
    work_source_version_id: row.work_source_version_id,
    order: {
      source_system: row.source_system,
      source_version_id: row.source_version_id,
      order_id: row.order_id,
      location_id: row.location_id,
      retrieved_at: row.retrieved_at,
      content_hash: row.content_hash,
      payload: row.payload,
      order_presentation: row.order_presentation,
    },
  }
}
