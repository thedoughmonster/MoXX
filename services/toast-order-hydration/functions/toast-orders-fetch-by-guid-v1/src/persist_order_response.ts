import { sql } from "./database.ts"
import type {
  ClaimedJob,
  PersistedOrder,
  ToastOrderResponse,
} from "./types.ts"

export async function persistOrderResponse(
  job: ClaimedJob,
  response: ToastOrderResponse,
  contentHash: string,
  isValid: boolean,
): Promise<PersistedOrder> {
  const outcome = isValid ? "succeeded" : "invalid_response"
  const errorMessage = isValid ? null : "Toast order response was invalid"
  const rows = await sql<PersistedOrder[]>`
    with inserted as (
      insert into toast_raw.orders (
        restaurant_guid,
        requested_order_guid,
        source_operation,
        content_hash,
        payload
      ) values (
        ${job.restaurant_guid},
        ${job.order_guid},
        ${job.function_key},
        ${contentHash},
        ${sql.json(response.body)}
      )
      on conflict (
        restaurant_guid,
        requested_order_guid,
        content_hash
      ) do nothing
      returning id
    ), resource_version as (
      select id, true as was_inserted from inserted
      union all
      select existing.id, false as was_inserted
      from toast_raw.orders as existing
      where existing.restaurant_guid = ${job.restaurant_guid}
        and existing.requested_order_guid = ${job.order_guid}
        and existing.content_hash = ${contentHash}
        and not exists (select 1 from inserted)
      limit 1
    ), attempt_update as (
      update toast_hydration.order_hydration_attempts
      set finished_at = now(),
          outcome = ${outcome},
          http_status = ${response.status},
          response_headers = ${sql.json(response.response_headers)},
          order_version_id = (select id from resource_version),
          error_code = ${isValid ? null : "toast_order_contract_mismatch"},
          error_message = ${errorMessage}
      where id = ${job.attempt_id}::bigint
      returning job_id
    ), job_update as (
      update toast_hydration.order_hydration_jobs as hydration_job
      set status = ${isValid ? "succeeded" : "failed"},
          lease_expires_at = null,
          completed_at = case when ${isValid} then now() else null end,
          last_error = ${errorMessage}
      from attempt_update
      where hydration_job.id = attempt_update.job_id
      returning hydration_job.id
    ), api_work as (
      insert into momi_orders.api_invocation_work (
        source_system,
        source_work_kind,
        source_work_id,
        source_resource_kind,
        source_version_id,
        location_id,
        order_id,
        api_contract_key
      )
      select
        'toast',
        'order_hydration_job',
        ${job.job_id},
        'order',
        resource_version.id::text,
        ${job.restaurant_guid},
        ${job.order_guid},
        ${job.downstream_api_contract_key}
      from resource_version
      where ${isValid}
      on conflict (
        source_system,
        source_resource_kind,
        source_version_id,
        api_contract_key
      ) do nothing
    )
    select id::text as order_version_id, was_inserted
    from resource_version
  `

  if (rows.length !== 1) {
    throw new Error("Toast order resource version was not persisted")
  }

  return rows[0]
}
