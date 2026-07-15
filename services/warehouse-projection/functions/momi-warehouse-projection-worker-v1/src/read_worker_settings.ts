import { sql } from "./database.ts"
import type { ProjectionWorkerSettings } from "./types.ts"

export async function readWorkerSettings(): Promise<ProjectionWorkerSettings> {
  const rows = await sql<ProjectionWorkerSettings[]>`
    select settings.worker_max_runtime_seconds,
      settings.worker_max_deliveries,
      settings.handoff_reserve_seconds,
      settings.shutdown_margin_seconds
    from warehouse_projection.worker_settings as settings
    where settings.subscription_key = 'warehouse-projection-toast-v1'
  `
  if (!rows[0]) throw new Error("projection_worker_settings_missing")
  return rows[0]
}
