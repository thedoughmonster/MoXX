import { sql } from "./database.ts";
import type { ClaimedJob, RegisteredOperation } from "./registry_types.ts";

export async function loadRegisteredOperation(
  job: ClaimedJob,
): Promise<RegisteredOperation | null> {
  const rows = await sql<RegisteredOperation[]>`
    select
      operation.operation_key,
      operation.source_operation_id,
      operation.http_method,
      operation.path_template,
      operation.resource_type,
      operation.response_kind,
      operation.pagination_kind,
      operation.page_size,
      operation.requires_window,
      operation.exact_resource_only,
      operation.schema_version,
      source.api_base_url,
      source.client_id_secret_name,
      source.client_secret_secret_name,
      source.user_access_type,
      source.request_timeout_ms,
      restaurant.first_business_date::text,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'parameter_key', parameter.parameter_key,
            'parameter_location', parameter.parameter_location,
            'data_type', parameter.data_type,
            'required', parameter.required,
            'validation_pattern', parameter.validation_pattern
          ) order by parameter.parameter_location, parameter.parameter_key
        ) filter (where parameter.parameter_key is not null),
        '[]'::jsonb
      ) as operation_parameters
    from toast_acquisition.operations as operation
    join toast_acquisition.sources as source
      on source.source_key = ${job.source_key} and source.is_enabled
    join toast_acquisition.restaurants as restaurant
      on restaurant.source_key = source.source_key
      and restaurant.restaurant_guid = ${job.restaurant_guid}
      and restaurant.is_enabled
    left join toast_acquisition.operation_parameters as parameter
      on parameter.operation_key = operation.operation_key
    where operation.operation_key = ${job.operation_key}
      and operation.is_enabled
    group by operation.operation_key, source.source_key,
      restaurant.source_key, restaurant.restaurant_guid
  `;
  return rows[0] ?? null;
}
