import type { RecoverySnapshot } from "./recovery_types.ts"

export function generateRecoveryBoundaryConfigSql(snapshot: RecoverySnapshot): string {
  const boundary = JSON.stringify({
    cohortStartedAtUtcMs: snapshot.cohortStartedAtUtcMs,
    jobHighWater: snapshot.jobHighWater,
    observationHighWater: snapshot.observationHighWater,
    dueOccurrences: snapshot.dueOccurrences,
    queueMappingCount: snapshot.queueMappingCount,
    queueMappingSha256: snapshot.queueMappingSha256,
    priorMembershipProof: snapshot.cohortMembershipProof,
    priorLineageProof: snapshot.cohortLineageProof,
  })
  const encoded = Buffer.from(boundary, "utf8").toString("hex")
  return `select set_config('momi.recovery_boundary', convert_from(decode('${encoded}', 'hex'), 'UTF8'), true);`
}
