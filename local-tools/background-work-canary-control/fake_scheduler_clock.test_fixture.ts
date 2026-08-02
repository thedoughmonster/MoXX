import type { SchedulerClock, SchedulerTimer } from "./schedule_types.ts"

type ScheduledTask = {
  atUtcMs: number
  order: number
  cancelled: boolean
  task: () => void
}

export function createFakeSchedulerClock(startUtcMs: number): {
  clock: SchedulerClock
  timer: SchedulerTimer
  delayAt: (utcMs: number, delayMs: number) => void
  dropAt: (utcMs: number) => void
  drain: () => Promise<void>
} {
  let nowUtcMs = startUtcMs
  let order = 0
  const tasks: ScheduledTask[] = []
  const delays = new Map<number, number>()
  const dropped = new Set<number>()
  const clock: SchedulerClock = { nowUtcMs: () => nowUtcMs }
  const timer: SchedulerTimer = {
    setAt: (atUtcMs, task) => {
      const scheduled = { atUtcMs, order: order++, cancelled: false, task }
      tasks.push(scheduled)
      return () => {
        scheduled.cancelled = true
      }
    },
  }
  return {
    clock,
    timer,
    delayAt: (utcMs, delayMs) => delays.set(utcMs, delayMs),
    dropAt: (utcMs) => dropped.add(utcMs),
    drain: async () => {
      let steps = 0
      while (tasks.some((task) => !task.cancelled)) {
        if (steps++ > 10_000) throw new Error("Fake scheduler exceeded task limit")
        tasks.sort((left, right) =>
          left.atUtcMs - right.atUtcMs || left.order - right.order
        )
        const scheduled = tasks.shift()
        if (!scheduled || scheduled.cancelled) continue
        if (dropped.has(scheduled.atUtcMs)) continue
        nowUtcMs = Math.max(
          nowUtcMs,
          scheduled.atUtcMs + (delays.get(scheduled.atUtcMs) ?? 0),
        )
        scheduled.task()
        await Promise.resolve()
      }
    },
  }
}
