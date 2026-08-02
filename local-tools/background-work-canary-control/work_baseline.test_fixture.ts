import type { WorkBaseline } from "./work_baseline_types.ts"

export const VALID_WORK_BASELINE = {
  toastReady: 0,
  routingReady: 0,
  deliveryReady: 0,
  queueReady: 0,
} satisfies WorkBaseline
