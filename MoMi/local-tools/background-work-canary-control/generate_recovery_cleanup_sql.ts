import { generateCleanupSql } from "./generate_cleanup_sql.ts"
import type { RecoveryControlInput } from "./recovery_control_types.ts"
import { validateRunId } from "./validate_run_id.ts"

export function generateRecoveryCleanupSql(
  input: RecoveryControlInput, runId: string,
  generationSha256: string | readonly string[],
  deadmanReconciled: boolean,
): string {
  validateRunId(runId)
  const generations = Array.isArray(generationSha256) ? generationSha256 : [generationSha256]
  if (generations.length < 1 || generations.length > 2 ||
    generations.some((generation) => !/^[a-f0-9]{64}$/.test(generation)) ||
    typeof deadmanReconciled !== "boolean") {
    throw new Error("Recovery cleanup generation is invalid")
  }
  let sql = generateCleanupSql(input)
  const generationCheck = generations.map((generation) =>
    `position('momi:deadman:generation:${runId}:${generation}' in guard_command) > 0`,
  ).join(" or ")
  const replacements: Array<[string, string]> = [
    ["  guard_name text; guard_schedule text; guard_active boolean; unscheduled boolean;",
      "  guard_name text; guard_schedule text; guard_active boolean; guard_command text; unscheduled boolean;"],
    ["  select j.jobname, j.schedule, j.active\n  into strict guard_name, guard_schedule, guard_active",
      "  select j.jobname, j.schedule, j.active, j.command\n  into strict guard_name, guard_schedule, guard_active, guard_command"],
    [`  if guard_name <> '${input.guardName}' or guard_schedule <> '${input.guardSchedule}' then\n` +
      "    raise exception 'momi_cleanup_guard_identity'; end if;",
      `  if guard_name <> '${input.guardName}' or guard_schedule <> '${input.guardSchedule}' then\n` +
      "    raise exception 'momi_cleanup_guard_identity'; end if;\n" +
      `  if not (${generationCheck}) then\n` +
      "    raise exception 'momi_recovery_cleanup_generation'; end if;"],
  ]
  for (const [before, after] of replacements) {
    if (sql.split(before).length !== 2) throw new Error("Accepted cleanup framing drifted")
    sql = sql.replace(before, after)
  }
  return sql
}
