import { sql } from "./database.ts"

export async function projectToastEvent(eventId: string): Promise<unknown> {
  const rows = await sql<{ outcome: unknown }[]>`
    select warehouse_projection.project_toast_event(
      ${eventId}::uuid
    ) as outcome
  `
  if (rows.length !== 1) {
    throw new Error("projector_result_missing")
  }
  return rows[0].outcome
}
