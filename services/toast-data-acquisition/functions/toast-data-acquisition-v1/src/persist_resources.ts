import { sql } from "./database.ts";
import type { JsonObject } from "./json_types.ts";
import type { ClaimedJob, RegisteredOperation } from "./registry_types.ts";
import type { ResourceRecord } from "./runtime_types.ts";

export async function persistResourceObservations(
  job: ClaimedJob,
  operation: RegisteredOperation,
  attemptId: string,
  observedAt: string,
  pageCursor: JsonObject,
  records: ResourceRecord[],
): Promise<number> {
  if (records.length === 0) return 0;
  const rows = await sql<{ observation_count: number }[]>`
    with input as (
      select entry.value as record, entry.ordinality
      from jsonb_array_elements(${sql.json(records)}::jsonb)
        with ordinality as entry(value, ordinality)
    ), normalized as (
      select
        ordinality,
        record ->> 'source_id' as source_id,
        record ->> 'source_version_id' as source_version_id,
        nullif(record ->> 'source_updated_at', '')::timestamptz as source_updated_at,
        record ->> 'content_hash' as content_hash,
        record -> 'payload' as payload
      from input
    ), inserted as (
      insert into toast_raw.resource_versions (
        source_system, resource_type, restaurant_guid, source_id,
        source_version_id, source_updated_at, retrieved_at, content_hash,
        payload, first_attempt_id
      )
      select distinct on (source_id, content_hash)
        'toast', ${operation.resource_type}, ${job.restaurant_guid}, source_id,
        source_version_id, source_updated_at, ${observedAt}::timestamptz,
        content_hash, payload, ${attemptId}::uuid
      from normalized
      order by source_id, content_hash, ordinality
      on conflict (
        source_system, resource_type, restaurant_guid, source_id, content_hash
      ) do update set content_hash = excluded.content_hash
      returning resource_version_id, source_id, content_hash
    ), version_rows as (
      select resource_version_id, source_id, content_hash from inserted
      union all
      select existing.resource_version_id, existing.source_id, existing.content_hash
      from toast_raw.resource_versions as existing
      where existing.source_system = 'toast'
        and existing.resource_type = ${operation.resource_type}
        and existing.restaurant_guid = ${job.restaurant_guid}
        and exists (
          select 1 from normalized
          where normalized.source_id = existing.source_id
            and normalized.content_hash = existing.content_hash
        )
        and not exists (
          select 1 from inserted
          where inserted.source_id = existing.source_id
            and inserted.content_hash = existing.content_hash
        )
    ), observations as (
      insert into toast_raw.resource_observations (
        resource_version_id, attempt_id, observed_at, page_cursor, correlation_id
      )
      select version.resource_version_id, ${attemptId}::uuid,
        ${observedAt}::timestamptz, ${sql.json(pageCursor)},
        ${job.correlation_id}::uuid
      from normalized
      join version_rows as version using (source_id, content_hash)
      returning observation_id
    )
    select count(*)::integer as observation_count from observations
  `;
  return rows[0]?.observation_count ?? 0;
}
