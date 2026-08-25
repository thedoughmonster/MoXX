import { EXPECTED_TARGET_JOBS } from "./sample_constants.ts"
import type { TargetJobState } from "./sample_types.ts"
import type { FinalTargetEvidence } from "./final_artifact_types.ts"

export function buildFinalTargetEvidence(
  targets: readonly TargetJobState[] | null,
): FinalTargetEvidence {
  if (targets === null) return {
    eventRouting: null, toastAcquisition: null,
    warehouseProjectionDatabase: null, warehouseProjectionWakeup: null,
  }
  if (targets.length !== EXPECTED_TARGET_JOBS.length) {
    throw new Error("Final target evidence is incomplete")
  }
  const states = new Map(targets.map((target) => [target.jobId, target]))
  for (const expected of EXPECTED_TARGET_JOBS) {
    const observed = states.get(expected.jobId)
    if (!observed || observed.jobName !== expected.jobName ||
      observed.schedule !== expected.schedule ||
      observed.commandMd5 !== expected.commandMd5) {
      throw new Error("Final target evidence identity changed")
    }
  }
  return {
    eventRouting: !states.get(2)!.active,
    toastAcquisition: !states.get(3)!.active,
    warehouseProjectionWakeup: !states.get(4)!.active,
    warehouseProjectionDatabase: !states.get(11)!.active,
  }
}
