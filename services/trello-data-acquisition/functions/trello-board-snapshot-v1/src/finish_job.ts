import type { ClaimedJob, Database, SourceResult } from "./types.ts"

export async function finishJob(
  database: Database,
  job: ClaimedJob,
  result: SourceResult,
): Promise<"succeeded" | "failed"> {
  const rows = await database`
    select disposition, job_status
    from trello_acquisition.finish_board_snapshot_v1(
      ${job.jobId}::uuid,
      ${job.capabilityToken},
      ${result.httpStatus},
      ${database.json(result.headers)},
      ${result.payload === null ? null : database.json(result.payload)},
      ${result.rawText},
      ${result.errorCode}
    )
  `
  const row = rows[0]
  if (rows.length !== 1 || row.disposition !== "recorded" || (row.job_status !== "succeeded" && row.job_status !== "failed")) {
    throw new Error("Board snapshot completion returned an invalid result")
  }
  return row.job_status
}
