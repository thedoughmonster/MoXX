import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

export async function createCronHistoryDatabase(retentionMigration?: URL) {
  const database = new PGlite()
  const migrations = new URL("../../supabase/migrations/", import.meta.url)
  const sources = [
    new URL("cron_history_governance.sql", import.meta.url),
    new URL("20260805081324_govern_cron_history_retention_trigger_adapter.sql", migrations),
    new URL("20260805122000_derive_cron_history_provider_warning.sql", migrations),
  ]
  if (retentionMigration) sources.push(retentionMigration)
  try {
    for (const source of sources) {
      await database.exec(await readFile(source, "utf8"))
    }
    return database
  } catch (error) {
    await database.close()
    throw error
  }
}
