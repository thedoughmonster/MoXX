import type { ClaimedJob, Database, WorkRequest } from "./types.ts"

export async function claimJob(
  database: Database,
  work: WorkRequest,
): Promise<ClaimedJob | null> {
  const rows = await database`
    select job_id::text, board_id
    from trello_acquisition.claim_webhook_inventory_v1(
      ${work.jobId}::uuid,
      ${work.capabilityToken}
    )
  `
  const row = rows[0]
  if (rows.length === 0) return null
  if (
    rows.length !== 1 || typeof row.job_id !== "string"
    || typeof row.board_id !== "string"
  ) throw new Error("Webhook inventory claim returned an invalid result")
  return { ...work, jobId: row.job_id, boardId: row.board_id }
}
