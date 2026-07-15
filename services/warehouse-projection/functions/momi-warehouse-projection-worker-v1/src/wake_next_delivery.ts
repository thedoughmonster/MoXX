import { sql } from "./database.ts"

export async function wakeNextDelivery(): Promise<boolean> {
  const rows = await sql<{ woken: boolean }[]>`
    select warehouse_projection.wake_next_delivery() as woken
  `
  return rows[0]?.woken ?? false
}
