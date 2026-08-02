import type { DeadmanManualReason } from "./deadman_phase_types.ts"
import type { FastSample, ResourceSample } from "./sample_types.ts"

export type FinalReadbackResult =
  | { status: "passed"; fast: FastSample; resource: ResourceSample }
  | { status: "failed"; reason: Extract<DeadmanManualReason,
      "final_fast_failed" | "final_resource_failed" |
      "final_threshold_failed" | "receipt_failure"> }
