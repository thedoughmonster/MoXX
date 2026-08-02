import type { SchedulerTimer } from "./schedule_types.ts"

export function createUtcTimer(nowUtcMs: () => number): SchedulerTimer {
  return {
    setAt: (utcMs, task) => {
      const timer = setTimeout(task, Math.max(0, utcMs - nowUtcMs()))
      return () => clearTimeout(timer)
    },
  }
}
