import { getDatabase } from "../../momi-model-execution-gateway-v1/src/database.ts"
import type { ClaimedCompletion } from "./types.ts"

export async function retryWork(work: ClaimedCompletion, errorCode: string): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ retried: boolean }[]>`
    select momi_model_execution.retry_completion_work_v1(
      ${work.work_id}::uuid, ${work.capability_token}::uuid, ${errorCode}
    ) as retried
  `
  if (!rows[0]?.retried) throw new Error("completion_retry_failed")
}
