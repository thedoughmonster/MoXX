import { readFile } from "node:fs/promises"
import { emptyDatabase } from "./empty_database.ts"

export async function invoiceDatabase() {
  const db = await emptyDatabase()
  const migration = await readFile(new URL(
    "../../../supabase/migrations/20261014090216_create_wholesale_invoice_calendar_foundation.sql",
    import.meta.url,
  ), "utf8")
  try { await db.exec("begin;" + migration + "commit;") } catch (error) { await db.close(); throw error }
  return db
}
