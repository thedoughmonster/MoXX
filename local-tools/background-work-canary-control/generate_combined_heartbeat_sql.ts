import { COMBINED_HEARTBEAT_MARKER } from "./combined_heartbeat_constants.ts"
import { generateGuardHeartbeatSql } from "./generate_guard_heartbeat_sql.ts"
import { GUARD_HEARTBEAT_MARKER } from "./guard_heartbeat_constants.ts"
import { loadCombinedSampleArtifact } from "./load_combined_sample_artifact.ts"
import { SQL_SCHEMA_VERSION } from "./sql_artifact_constants.ts"
import { validateCombinedHeartbeatInput } from "./validate_combined_heartbeat_input.ts"

export function generateCombinedHeartbeatSql(value: unknown): string {
  const input = validateCombinedHeartbeatInput(value)
  const { includeResource, ...heartbeatInput } = input
  const transition = generateGuardHeartbeatSql(heartbeatInput)
  const priorResult = `select '${GUARD_HEARTBEAT_MARKER}'::text as marker,\n`
  const boundary = transition.indexOf(priorResult)
  if (boundary < 1 || transition.indexOf(priorResult, boundary + 1) !== -1 ||
    !transition.endsWith("commit;\n")) {
    throw new Error("Accepted heartbeat transition framing drifted")
  }
  const fastSql = loadCombinedSampleArtifact("fast").replace(/^/gm, "  ")
  const resourceSql = includeResource
    ? loadCombinedSampleArtifact("resource").replace(/^/gm, "  ")
    : null
  const resourceCte = resourceSql
    ? [",", "resource_envelope as (", resourceSql, ")"].join("\n")
    : ""
  const resourceField = includeResource ? "r.sample" : "null::jsonb"
  const resourceJoin = includeResource ? "\ncross join resource_envelope r" : ""
  return transition.slice(0, boundary) + [
    "with heartbeat_clock as (",
    "  select substring(j.command from 'timestamptz ''([^'']+)''')::timestamptz",
    "    - interval '30 seconds' as observed_at",
    `  from cron.job j where j.jobid = ${input.guardJobId}`,
    "),",
    "heartbeat_evidence as (",
    "  select jsonb_build_object(",
    "    'guardJobId', j.jobid, 'guardName', j.jobname,",
    "    'guardSchedule', j.schedule, 'guardActive', j.active,",
    `    'runId', '${input.runId}',`,
    `    'previousGenerationSha256', '${input.currentGenerationSha256}',`,
    `    'nextGenerationSha256', '${input.nextGenerationSha256}',`,
    "    'expiryUtc', substring(j.command from 'timestamptz ''([^'']+)'''),",
    "    'commandSha256', encode(extensions.digest(",
    "      convert_to(j.command, 'UTF8'), 'sha256'), 'hex'),",
    "    'commandMd5', md5(j.command),",
    "    'observedAtUtcMs', floor(extract(epoch from c.observed_at) * 1000)::bigint",
    "  ) as heartbeat",
    "  from cron.job j cross join heartbeat_clock c",
    `  where j.jobid = ${input.guardJobId}`,
    "),",
    "fast_envelope as (",
    fastSql,
    ")",
    resourceCte,
    "select",
    `  '${COMBINED_HEARTBEAT_MARKER}'::text as marker,`,
    `  ${SQL_SCHEMA_VERSION}::integer as schema_version,`,
    "  jsonb_build_object(",
    "    'heartbeat', h.heartbeat,",
    "    'fast', f.sample,",
    `    'resourceIncluded', ${includeResource ? "true" : "false"},`,
    `    'resource', ${resourceField}`,
    "  ) as sample",
    "from heartbeat_evidence h",
    "cross join fast_envelope f" + resourceJoin + ";",
    "commit;",
    "",
  ].join("\n")
}
