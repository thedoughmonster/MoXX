import { sql } from "./database.ts"
import type { SourceEvent } from "./types.ts"

export async function readSourceEvent(
  eventId: string,
): Promise<SourceEvent | null> {
  const rows = await sql<SourceEvent[]>`
    select event.event_id::text as event_id,
      event.event_name,
      event.source_system,
      event.entity_type,
      event.entity_id::text as entity_id,
      (to_jsonb(event.occurred_at) #>> '{}') as occurred_at,
      event.schema_version,
      event.source_reference,
      event.correlation_id::text as correlation_id
    from momi_events.events as event
    where event.event_id = ${eventId}::uuid
  `
  return rows[0] ?? null
}
