import {
  DRY_RUN_DURATION_SECONDS,
  FAST_SAMPLE_INTERVAL_SECONDS,
  RESOURCE_SAMPLE_INTERVAL_SECONDS,
} from "./schedule_constants.ts"
import type { SampleBoundary } from "./schedule_types.ts"

export function planDryRunBoundaries(startBoundaryUtcMs: number): SampleBoundary[] {
  const intervalMs = FAST_SAMPLE_INTERVAL_SECONDS * 1000
  if (!Number.isSafeInteger(startBoundaryUtcMs) || startBoundaryUtcMs < 0 ||
    startBoundaryUtcMs % intervalMs !== 0) {
    throw new Error("Dry-run start must be an exact UTC 15-second boundary")
  }
  const boundaries: SampleBoundary[] = []
  for (let offsetSeconds = 0; offsetSeconds <= DRY_RUN_DURATION_SECONDS;
    offsetSeconds += FAST_SAMPLE_INTERVAL_SECONDS) {
    boundaries.push({
      index: boundaries.length,
      offsetSeconds,
      scheduledAtUtcMs: startBoundaryUtcMs + offsetSeconds * 1000,
      fast: true,
      resource: offsetSeconds % RESOURCE_SAMPLE_INTERVAL_SECONDS === 0,
    })
  }
  return boundaries
}
