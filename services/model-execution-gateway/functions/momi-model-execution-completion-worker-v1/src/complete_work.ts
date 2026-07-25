import { getDatabase } from "../../momi-model-execution-gateway-v1/src/database.ts"
import type { ClaimedCompletion } from "./types.ts"

export async function completeWork(work: ClaimedCompletion): Promise<void> {
  const sql = getDatabase()
  const rows = await sql<{ completed: boolean }[]>`
    select momi_model_execution.complete_completion_work_v1(
      ${work.work_id}::uuid, ${work.capability_token}::uuid
    ) as completed
  `
  if (!rows[0]?.completed) throw new Error("completion_ack_failed")
}
