import type { PGlite } from "@electric-sql/pglite"
import { randomUUID } from "node:crypto"
import { invoiceFixture } from "./fixture.ts"

export async function saveOrder(
  db: PGlite, revision = 0, version = invoiceFixture.version,
  command = randomUUID(), order = invoiceFixture.order,
) {
  const result = await db.query<{ result: {
    order_id: string; version_id: string; revision: number; command_id: string; effective_from: string
  } }>("select bridge.invoice_save_standing_order_v1($1,$2,$3,$4) as result",
  [command, revision, JSON.stringify(order), JSON.stringify(version)])
  return result.rows[0].result
}
