import { sql } from "./database.ts"
import { contractVersion, type EntityReadContract,
  type EntityReadInput, type EntityReadRow } from "./types.ts"

export async function readEntity(
  input: EntityReadInput,
  contract: EntityReadContract,
): Promise<EntityReadRow> {
  const rows = await sql<EntityReadRow[]>`
    with authorized_work as (
      select momi_api.consume_read_capability(
        ${input.work_id}::bigint,
        ${contract.functionKey},
        ${input.entity_id}::uuid,
        null,
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
      record.entity_id::text, record.entity_type, record.schema_version,
      record.canonical_document, record.provenance, record.freshness
    from (values (true)) as request(present)
    left join authorized_work as work on true
    left join active_contract as contract on true
    left join ${sql("momi_api")}.${sql(contract.viewName)} as record
      on work.work_id is not null and contract.active
      and record.entity_id = ${input.entity_id}::uuid
    limit 1
  `
  return rows[0] ?? { work_id: null, contract_active: false,
    entity_id: null, entity_type: null, schema_version: null,
    canonical_document: null, provenance: null, freshness: null }
}
