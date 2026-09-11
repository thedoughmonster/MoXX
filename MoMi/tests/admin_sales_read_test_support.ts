import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

export async function adminTestDatabase(): Promise<PGlite> {
  const [fixture, migration] = await Promise.all([
    readFile(new URL("./fixtures/admin-sales-read.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/" +
      "20260911085554_add_admin_sales_read_contract.sql", import.meta.url), "utf8"),
  ])
  const database = new PGlite()
  await database.exec(fixture + migration)
  return database
}
