import { sql } from "./database.ts"
import type { SourceEvent } from "./types.ts"

export async function readSourceEvent(
  eventId: string,
  messageId: string,
  capabilityToken: string,
): Promise<SourceEvent | null> {
  const rows = await sql<SourceEvent[]>`
    select reference.event_id::text as event_id,
      reference.event_name, reference.source_system,
      reference.entity_type, reference.entity_id::text as entity_id,
      (to_jsonb(reference.occurred_at) #>> '{}') as occurred_at,
      reference.schema_version, reference.source_reference,
      reference.correlation_id::text as correlation_id
    from momi_events.read_warehouse_projection_delivery_reference_v1(
      ${eventId}::uuid,
      ${messageId}::bigint,
      ${capabilityToken}::uuid
    ) as reference
  `
  return rows[0] ?? null
}
