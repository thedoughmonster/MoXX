import {
  LIFECYCLE_DEADLINE_MS,
  MAX_LAUNCH_LATENESS_MS,
  PROVIDER_DEADLINE_MS,
} from "./schedule_constants.ts"
import type {
  SampleBoundary,
  SampleLifecycle,
  SchedulerDependencies,
  SchedulerResult,
  SchedulerStopReason,
} from "./schedule_types.ts"

export function runBoundaryScheduler(
  boundaries: readonly SampleBoundary[],
  dependencies: SchedulerDependencies,
): Promise<SchedulerResult> {
  if (boundaries.length === 0) throw new Error("Boundary schedule is empty")
  let nextIndex = 0
  let active: { index: number; stage: number } | undefined
  let finished = false
  const cancellations: Array<() => void> = []
  return new Promise<SchedulerResult>((resolve) => {
    const finish = (reason?: SchedulerStopReason) => {
      if (finished) return
      finished = true
      for (const cancel of cancellations) cancel()
      if (reason) dependencies.onStop?.(reason)
      resolve(reason ? { status: "stopped", reason } : { status: "completed" })
    }
    const abort = () => finish("cancelled")
    dependencies.signal?.addEventListener("abort", abort, { once: true })
    cancellations.push(() => dependencies.signal?.removeEventListener("abort", abort))
    if (dependencies.signal?.aborted) return abort()
    const mark = (index: number, stage: number, lateReason: SchedulerStopReason,
      stopAfter = false) => {
      if (finished || active?.index !== index) return
      if (active.stage !== stage - 1) return finish("sample_stage_order_invalid")
      const elapsed = dependencies.clock.nowUtcMs() - boundaries[index].scheduledAtUtcMs
      const deadline = stage === 1 ? PROVIDER_DEADLINE_MS : LIFECYCLE_DEADLINE_MS
      if (elapsed > deadline) return finish(lateReason)
      active.stage = stage
      if (stage === 4) {
        active = undefined
        if (stopAfter) return finish("sample_lifecycle_failed")
        if (nextIndex === boundaries.length) finish()
      }
    }
    for (const [index, boundary] of boundaries.entries()) {
      cancellations.push(dependencies.timer.setAt(boundary.scheduledAtUtcMs, () => {
        if (finished) return
        if (index !== nextIndex) return finish("missing_boundary")
        if (dependencies.clock.nowUtcMs() - boundary.scheduledAtUtcMs >
          MAX_LAUNCH_LATENESS_MS) return finish("launch_lateness_exceeded")
        if (active) return finish("sample_overlap")
        active = { index, stage: 0 }
        nextIndex += 1
        const lifecycle: SampleLifecycle = {
          providerComplete: () => mark(index, 1, "provider_deadline_exceeded"),
          parseComplete: () => mark(index, 2, "parse_deadline_exceeded"),
          evaluateComplete: () => mark(index, 3, "evaluate_deadline_exceeded"),
          receiptComplete: () => mark(index, 4, "receipt_deadline_exceeded"),
          stopAfterReceipt: () => mark(
            index, 4, "receipt_deadline_exceeded", true,
          ),
          fail: () => finish("sample_lifecycle_failed"),
        }
        cancellations.push(dependencies.timer.setAt(
          boundary.scheduledAtUtcMs + PROVIDER_DEADLINE_MS + 1,
          () => active?.index === index && active.stage < 1 &&
            finish("provider_deadline_exceeded"),
        ))
        cancellations.push(dependencies.timer.setAt(
          boundary.scheduledAtUtcMs + LIFECYCLE_DEADLINE_MS + 1,
          () => {
            if (active?.index !== index || active.stage === 4) return
            const reasons: SchedulerStopReason[] = [
              "parse_deadline_exceeded",
              "evaluate_deadline_exceeded",
              "receipt_deadline_exceeded",
            ]
            finish(reasons[Math.max(0, active.stage - 1)])
          },
        ))
        try {
          dependencies.launch(boundary, lifecycle)
        } catch {
          finish("sample_lifecycle_failed")
        }
      }))
      cancellations.push(dependencies.timer.setAt(
        boundary.scheduledAtUtcMs + MAX_LAUNCH_LATENESS_MS + 1,
        () => !finished && nextIndex <= index && finish("missing_boundary"),
      ))
    }
  })
}
