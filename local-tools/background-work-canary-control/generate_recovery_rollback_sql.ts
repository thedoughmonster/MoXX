import { generateRollbackSql } from "./generate_rollback_sql.ts"
import type { RecoveryControlInput } from "./recovery_control_types.ts"
import { validateRunId } from "./validate_run_id.ts"

export function generateRecoveryRollbackSql(
  input: RecoveryControlInput, runId: string, generationSha256: string | readonly string[],
): string {
  validateRunId(runId)
  const generations = Array.isArray(generationSha256) ? generationSha256 : [generationSha256]
  if (generations.length < 1 || generations.length > 2 ||
    generations.some((generation) => !/^[a-f0-9]{64}$/.test(generation))) {
    throw new Error("Recovery rollback generation is invalid")
  }
  const generationCheck = generations.map((generation) =>
    `position('momi:deadman:generation:${runId}:${generation}' in guard_command) > 0`,
  ).join(" or ")
  let sql = generateRollbackSql(input)
  const replacements: Array<[string, string]> = [
    ["  guard_name text; guard_schedule text;",
      "  guard_name text; guard_schedule text; guard_command text;"],
    ["    select j.jobname, j.schedule, j.active\n    into strict guard_name, guard_schedule, guard_active",
      "    select j.jobname, j.schedule, j.active, j.command\n    into strict guard_name, guard_schedule, guard_active, guard_command"],
    ["      raise exception 'momi_rollback_guard_identity'; end if;",
      "      raise exception 'momi_rollback_guard_identity'; end if;\n" +
      `    if not (${generationCheck}) then\n` +
      "      raise exception 'momi_recovery_rollback_generation'; end if;"],
    ["  perform cron.alter_job(job_id := 4, active := false);\n", ""],
  ]
  for (const [before, after] of replacements) {
    if (sql.split(before).length !== 2) throw new Error("Accepted rollback framing drifted")
    sql = sql.replace(before, after)
  }
  return sql
}
