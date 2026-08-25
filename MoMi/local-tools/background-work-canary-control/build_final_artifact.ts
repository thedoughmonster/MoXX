import { FINAL_ARTIFACT_STATUSES } from "./final_artifact_constants.ts"
import type { FinalArtifact, FinalArtifactInput } from "./final_artifact_types.ts"
import { buildFinalTargetEvidence } from "./build_final_target_evidence.ts"
import { generateDeadmanTerminalCommand } from "./generate_deadman_terminal_command.ts"
import { md5Text } from "./md5_text.ts"
import { sha256Text } from "./sha256_text.ts"

export function buildFinalArtifact(
  input: FinalArtifactInput,
  startedAtUtc: string,
  terminalHash: string,
): FinalArtifact {
  if (!FINAL_ARTIFACT_STATUSES.includes(input.status) ||
    !/^run-[a-f0-9]{24}$/.test(input.runId) ||
    !/^[a-f0-9]{40}$/.test(input.runtime.repository.headSha) ||
    !/^[a-f0-9]{64}$/.test(terminalHash) ||
    new Date(startedAtUtc).toISOString() !== startedAtUtc ||
    new Date(input.terminalAtUtc).toISOString() !== input.terminalAtUtc ||
    input.runtime.options.projectRef !== "xtbraqnlskmqxinjxxdn" ||
    (input.reason !== null && !/^[a-z0-9_]{1,64}$/.test(input.reason))) {
    throw new Error("Final artifact input is invalid")
  }
  const fast = input.finalFast
  const resource = input.finalResource
  const deadman = input.deadmanEvidence
  if (deadman) {
    const { guardStatus: _status, terminalCommandSha256,
      terminalCommandMd5, successfulTerminalRunCount,
      terminalFailureCount, ...terminalInput } = deadman
    const command = generateDeadmanTerminalCommand(terminalInput)
    if (deadman.guardStatus !== "succeeded" || successfulTerminalRunCount !== 1 ||
      terminalFailureCount !== 0 || terminalCommandSha256 !== sha256Text(command) ||
      terminalCommandMd5 !== md5Text(command)) {
      throw new Error("Final dead-man evidence is invalid")
    }
  }
  if (input.status === "inactive_dry_run_verified" && !deadman) {
    throw new Error("Verified dry run requires terminal dead-man evidence")
  }
  return {
    schemaVersion: 2, runId: input.runId,
    releasedHeadSha: input.runtime.repository.headSha,
    projectRef: input.runtime.options.projectRef,
    terminal: { status: input.status, reason: input.reason },
    sampling: { fastCount: input.fastCount, resourceCount: input.resourceCount },
    guard: { resolution: input.guardResolution, absent: input.guardAbsent },
    targetsInactive: buildFinalTargetEvidence(input.targetJobs),
    deadmanEvidence: input.deadmanEvidence,
    cumulativeEvidence: fast && resource ? {
      guardFailures: input.deadmanEvidence?.terminalFailureCount ??
        resource.guardRunFailures,
      guardRunCount: input.deadmanEvidence?.successfulTerminalRunCount ??
        resource.guardRunCount,
      targetFailures: resource.targetRunFailures,
      targetRunCount: resource.targetRunCount,
      toastReady: fast.toastReady, routingReady: fast.routingReady,
      deliveryReady: fast.deliveryReady, queueReady: fast.queueReady,
    } : null,
    resourceEvidence: resource ? {
      cronHistoryGrowthBytes: resource.cronHistoryGrowthBytes,
      databaseBackends: resource.databaseBackends,
      databaseGrowthBytes: resource.databaseGrowthBytes,
      deadlockDelta: resource.deadlockDelta,
      guardCronHistoryEstimatedBytes: resource.guardCronHistoryEstimatedBytes,
      totalTaskGrowthBytes: resource.totalTaskGrowthBytes,
      waitingLocks: resource.waitingLocks,
      walDirectoryBytes: resource.walDirectoryBytes,
    } : null,
    receipt: { terminalHash },
    timestamps: { startedAtUtc, terminalAtUtc: input.terminalAtUtc },
  }
}
