import {
  GUARD_BOOTSTRAP_LOCK_TIMEOUT,
  GUARD_BOOTSTRAP_STATEMENT_TIMEOUT,
} from "./guard_bootstrap_constants.ts"
import {
  CLEANUP_DO_TAG,
  CLEANUP_MARKER,
} from "./recovery_control_constants.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"
import { validateRecoveryControlInput } from "./validate_recovery_control_input.ts"

export function generateCleanupSql(value: unknown): string {
  const input = validateRecoveryControlInput(value)
  const names = input.targetJobs.map((job) => `'${job.jobName}'`).join(", ")
  const cases = input.targetJobs.map((job) => [
    `    when ${job.jobId} then j.jobname = '${job.jobName}' and`,
    `      j.schedule = '${job.schedule}' and md5(j.command) = '${job.commandMd5}'`,
  ].join("\n")).join("\n")
  return [
    "begin;",
    `set local statement_timeout = '${GUARD_BOOTSTRAP_STATEMENT_TIMEOUT}';`,
    `set local lock_timeout = '${GUARD_BOOTSTRAP_LOCK_TIMEOUT}';`,
    `do ${CLEANUP_DO_TAG}`,
    "declare",
    "  lock_acquired boolean; targets_match boolean; targets_active boolean;",
    "  target_name_count bigint; guard_name_count bigint; guard_id_count bigint;",
    "  guard_name text; guard_schedule text; guard_active boolean; unscheduled boolean;",
    "begin",
    `  select pg_try_advisory_xact_lock(hashtextextended('${input.advisoryLockKey}', 0))`,
    "    into lock_acquired;",
    "  if not lock_acquired then raise exception 'momi_cleanup_lock_unavailable'; end if;",
    "  perform 1 from cron.job where jobid in (2, 3, 4, 11) for share;",
    "  select count(*) = 4 and bool_and(case j.jobid",
    cases,
    "    else false end), coalesce(bool_or(j.active), false)",
    "  into targets_match, targets_active",
    "  from cron.job j where j.jobid in (2, 3, 4, 11);",
    `  select count(*) into target_name_count from cron.job where jobname in (${names});`,
    "  if not coalesce(targets_match, false) or target_name_count <> 4 then",
    "    raise exception 'momi_cleanup_target_identity'; end if;",
    "  if targets_active then raise exception 'momi_cleanup_target_active'; end if;",
    `  select count(*) into guard_name_count from cron.job where jobname = '${input.guardName}';`,
    `  select count(*) into guard_id_count from cron.job where jobid = ${input.guardJobId};`,
    "  if guard_name_count = 0 and guard_id_count = 0 then return; end if;",
    "  if guard_name_count <> 1 or guard_id_count <> 1 then",
    "    raise exception 'momi_cleanup_guard_identity'; end if;",
    "  select j.jobname, j.schedule, j.active",
    "  into strict guard_name, guard_schedule, guard_active",
    `  from cron.job j where j.jobid = ${input.guardJobId} for update;`,
    `  if guard_name <> '${input.guardName}' or guard_schedule <> '${input.guardSchedule}' then`,
    "    raise exception 'momi_cleanup_guard_identity'; end if;",
    "  if guard_active then raise exception 'momi_cleanup_guard_active'; end if;",
    `  unscheduled := cron.unschedule(${input.guardJobId});`,
    "  if not coalesce(unscheduled, false) then raise exception 'momi_cleanup_unschedule'; end if;",
    "  if exists (select 1 from cron.job",
    `      where jobid = ${input.guardJobId} or jobname = '${input.guardName}') then`,
    "    raise exception 'momi_cleanup_readback'; end if;",
    "end",
    `${CLEANUP_DO_TAG};`,
    "with target_state as (",
    "  select jsonb_agg(jsonb_build_object(",
    "    'jobId', j.jobid, 'jobName', j.jobname, 'schedule', j.schedule,",
    "    'commandMd5', md5(j.command), 'active', j.active) order by j.jobid) as jobs",
    "  from cron.job j where j.jobid in (2, 3, 4, 11)",
    "), guard_state as (",
    `  select count(*)::bigint as rows from cron.job`,
    `  where jobid = ${input.guardJobId} or jobname = '${input.guardName}'`,
    ")",
    `select '${CLEANUP_MARKER}'::text as marker, ${SQL_SCHEMA_VERSION}::integer as schema_version,`,
    "  jsonb_build_object('targetJobs', t.jobs, 'guardIdentityCount', g.rows,",
    "    'guardPresent', g.rows > 0, 'guardJobId', 0,",
    "    'guardState', 'guard_absent') as sample",
    "from target_state t cross join guard_state g;",
    "commit;",
    "",
  ].join("\n")
}
