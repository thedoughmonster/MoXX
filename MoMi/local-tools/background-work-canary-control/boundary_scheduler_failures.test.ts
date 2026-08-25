import assert from "node:assert/strict"
import test from "node:test"

import { createFakeSchedulerClock } from "./fake_scheduler_clock.test_fixture.ts"
import { planDryRunBoundaries } from "./plan_dry_run_boundaries.ts"
import { runBoundaryScheduler } from "./run_boundary_scheduler.ts"

test("scheduler stops without catch-up for every timing and lifecycle breach", async () => {
  const startUtcMs = Date.UTC(2026, 7, 2, 12, 0, 0)
  const boundary = planDryRunBoundaries(startUtcMs)[0]

  const late = createFakeSchedulerClock(startUtcMs)
  late.delayAt(startUtcMs, 251)
  let lateLaunches = 0
  const latePromise = runBoundaryScheduler([boundary], {
    clock: late.clock, timer: late.timer, launch: () => { lateLaunches += 1 },
  })
  await late.drain()
  assert.deepEqual(await latePromise, {
    status: "stopped", reason: "launch_lateness_exceeded",
  })
  assert.equal(lateLaunches, 0)

  const missing = createFakeSchedulerClock(startUtcMs)
  missing.dropAt(startUtcMs)
  const missingPromise = runBoundaryScheduler([boundary], {
    clock: missing.clock, timer: missing.timer, launch: () => assert.fail("caught up"),
  })
  await missing.drain()
  assert.deepEqual(await missingPromise, { status: "stopped", reason: "missing_boundary" })

  const overlap = createFakeSchedulerClock(startUtcMs)
  const overlapPromise = runBoundaryScheduler([boundary, { ...boundary, index: 1 }], {
    clock: overlap.clock, timer: overlap.timer, launch: () => undefined,
  })
  await overlap.drain()
  assert.deepEqual(await overlapPromise, { status: "stopped", reason: "sample_overlap" })

  const deadlineCases = [
    ["provider_deadline_exceeded", []],
    ["parse_deadline_exceeded", ["providerComplete"]],
    ["evaluate_deadline_exceeded", ["providerComplete", "parseComplete"]],
    ["receipt_deadline_exceeded", [
      "providerComplete", "parseComplete", "evaluateComplete",
    ]],
  ] as const
  for (const [reason, stages] of deadlineCases) {
    const fake = createFakeSchedulerClock(startUtcMs)
    const resultPromise = runBoundaryScheduler([boundary], {
      clock: fake.clock,
      timer: fake.timer,
      launch: (_boundary, lifecycle) => {
        for (const stage of stages) lifecycle[stage]()
      },
    })
    await fake.drain()
    assert.deepEqual(await resultPromise, { status: "stopped", reason })
  }

  const order = createFakeSchedulerClock(startUtcMs)
  const orderPromise = runBoundaryScheduler([boundary], {
    clock: order.clock, timer: order.timer,
    launch: (_boundary, lifecycle) => lifecycle.parseComplete(),
  })
  await order.drain()
  assert.deepEqual(await orderPromise, {
    status: "stopped", reason: "sample_stage_order_invalid",
  })

  const failure = createFakeSchedulerClock(startUtcMs)
  const failurePromise = runBoundaryScheduler([boundary], {
    clock: failure.clock, timer: failure.timer,
    launch: (_boundary, lifecycle) => lifecycle.fail(),
  })
  await failure.drain()
  assert.deepEqual(await failurePromise, {
    status: "stopped", reason: "sample_lifecycle_failed",
  })
})
