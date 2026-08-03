import type { GuardHeartbeatInput } from "./guard_heartbeat_types.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import { GUARD_HEARTBEAT_MARKER } from "./guard_heartbeat_constants.ts"
import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"
import { RECOVERY_OBSERVATION_MARKER } from "./recovery_constants.ts"
import type { RecoveryActivation } from "./recovery_types.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"

export function generateRecoveryObservationSql(
  input: GuardHeartbeatInput, activation: RecoveryActivation, includeResource: boolean,
): string {
  if (typeof includeResource !== "boolean") throw new Error("Recovery resource flag is invalid")
  const inactiveCheck = "  if targets_active then raise exception 'momi_guard_heartbeat_target_active'; end if;"
  const runningCheck = "  if target_executions <> 0 then raise exception 'momi_guard_heartbeat_target_running'; end if;"
  const activeCheck = [
    "  if exists (select 1 from cron.job where jobid in (2, 3, 4, 11)",
    "      and active <> (jobid in (2, 3, 11))) then",
    "    raise exception 'momi_guard_heartbeat_target_state'; end if;",
  ].join("\n")
  let transition = generateGuardHeartbeatSql(input)
  if (transition.split(inactiveCheck).length !== 3 ||
    transition.split(runningCheck).length !== 3) {
    throw new Error("Accepted heartbeat transition framing drifted")
  }
  transition = transition.split(inactiveCheck).join(activeCheck)
    .split(runningCheck).join("  -- recovery canary permits exact target execution evidence")
  const priorResult = `select '${GUARD_HEARTBEAT_MARKER}'::text as marker,\n`
  const boundary = transition.indexOf(priorResult)
  if (boundary < 1 || !transition.endsWith("commit;\n")) {
    throw new Error("Recovery heartbeat transition framing is invalid")
  }
  let snapshotSource = loadRecoverySnapshotSql().trimEnd().slice(0, -1)
  if (!includeResource) {
    const baseline = activation.frozen
    const replacements: Array<[string, string]> = [
      ["pg_database_size(current_database())", `${baseline.databaseBytes}::bigint`],
      ["pg_total_relation_size('cron.job_run_details'::regclass)", `${baseline.cronHistoryBytes}::bigint`],
      ["(select coalesce(sum(size), 0) from pg_ls_waldir())", `${baseline.walDirectoryBytes}::bigint`],
      ["s.deadlocks", `${baseline.deadlocks}::bigint`], ["s.numbackends", `${baseline.databaseBackends}::bigint`],
      ["current_setting('max_connections')::integer", `${baseline.maxConnections}::integer`],
      ["current_setting('superuser_reserved_connections')::integer",
        `${baseline.reservedConnections}::integer`],
    ]
    for (const [before, after] of replacements) {
      if (snapshotSource.split(before).length !== 2) throw new Error("Recovery resource framing drifted")
      snapshotSource = snapshotSource.replace(before, after)
    }
  }
  const snapshot = snapshotSource.replace(/^/gm, "  ")
  const started = new Date(activation.startedAtUtcMs).toISOString()
  const startRunId = activation.frozen.maxCronRunId
  return transition.slice(0, boundary) + [
    "with recovery_snapshot as (", snapshot, "),",
    "run_evidence as (select",
    `  count(*) filter (where jobid in (2,3,4,11))::bigint target_runs,`,
    "  count(*) filter (where jobid in (2,3,4,11) and status not in ('running','succeeded'))::bigint failures,",
    "  count(*) filter (where status = 'succeeded' and ((jobid = 3 and return_message !~ '^UPDATE [012]$')",
    "    or (jobid = 2 and return_message !~ '^UPDATE [01]$')",
    "    or (jobid = 11 and return_message <> 'CALL')))::bigint invalid_returns,",
    "  count(*) filter (where jobid = 4)::bigint target_four_runs,",
    "  count(*) filter (where status = 'succeeded' and ((jobid = 3 and return_message ~ '^UPDATE [12]$')",
    "    or (jobid = 2 and return_message = 'UPDATE 1')))::bigint progress_runs,",
    `  count(*) filter (where jobid = ${input.guardJobId})::bigint guard_runs,`,
    `  count(*) filter (where jobid = ${input.guardJobId} and status not in ('running','succeeded'))::bigint guard_failures`,
    `  from cron.job_run_details where runid > ${startRunId}`,
    "    and runid <= (select (sample->>'maxCronRunId')::bigint from recovery_snapshot)",
    "), enriched as (select sample || jsonb_build_object(",
    "  'dueAtStartRemaining', (select count(*) from toast_acquisition.schedules",
    `    where active and next_due_at <= '${started}'::timestamptz),`,
    "  'targetRunCount', e.target_runs, 'targetRunFailures', e.failures,",
    "  'guardRunCount', e.guard_runs, 'guardRunFailures', e.guard_failures,",
    "  'invalidTargetReturns', e.invalid_returns, 'forbiddenTargetFourRuns', e.target_four_runs,",
    "  'completedSinceStart', e.progress_runs,",
    "  'sensitiveTelemetryViolations',",
    "    (select count(*) from toast_acquisition.jobs where status <> 'succeeded' and last_error is not null) +",
    "    (select count(*) from momi_events.routing_work where status <> 'succeeded' and last_error is not null) +",
    "    (select count(*) from momi_events.deliveries where status not in ('delivered','dead_letter') and last_error is not null),",
    "  'staleCapabilitySuccesses',",
    "    (select count(*) from toast_acquisition.jobs where status = 'succeeded' and lease_expires_at is not null) +",
    "    (select count(*) from momi_events.routing_work where status = 'succeeded' and lease_expires_at is not null) +",
    "    (select count(*) from momi_events.deliveries where status = 'delivered' and (lease_expires_at is not null or queue_message_id is not null)),",
    "  'producerTransactionProjectionViolations',",
    "    (select count(*) from momi_runtime.function_trigger_registry where function_key = 'momi.warehouse_projection.toast.consume.v1' and active),",
    "  'windowToastViolations', (select count(*) from toast_acquisition.jobs j",
    `    where j.created_at > '${started}'::timestamptz and (`,
    "      j.created_at >= to_timestamp(((sample->>'observedAtUtcMs')::bigint + 1) / 1000.0)))",
    "  ) observation from recovery_snapshot cross join run_evidence e)",
    `select '${RECOVERY_OBSERVATION_MARKER}'::text marker, ${SQL_SCHEMA_VERSION}::integer schema_version,`,
    "  jsonb_build_object('previousGenerationSha256',",
    `    '${input.currentGenerationSha256}', 'nextGenerationSha256', '${input.nextGenerationSha256}',`,
    `    'guardJobId', ${input.guardJobId}, 'observation', observation) sample from enriched;`,
    "commit;", "",
  ].join("\n")
}
