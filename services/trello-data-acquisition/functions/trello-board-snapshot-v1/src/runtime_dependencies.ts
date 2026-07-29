import { acquireBoardSnapshot } from "./acquire_board_snapshot.ts"
import { claimJob } from "./claim_job.ts"
import { sql } from "./database.ts"
import { finishJob } from "./finish_job.ts"
import type { SnapshotDependencies } from "./types.ts"

export const snapshotDependencies: SnapshotDependencies = {
  getSetting: (name) => Deno.env.get(name),
  claim: (work) => claimJob(sql, work),
  acquire: (job, key, token) => acquireBoardSnapshot(job, key, token),
  finish: (job, result) => finishJob(sql, job, result),
}
