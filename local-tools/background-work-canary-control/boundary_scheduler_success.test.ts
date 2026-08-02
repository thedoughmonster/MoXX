import assert from "node:assert/strict"
import test from "node:test"

import { createFakeSchedulerClock } from "./fake_scheduler_clock.test_fixture.ts"
import { planDryRunBoundaries } from "./plan_dry_run_boundaries.ts"
import { runBoundaryScheduler } from "./run_boundary_scheduler.ts"

test("dry-run planning and scheduling preserve every exact UTC boundary", async () => {
  const startUtcMs = Date.UTC(2026, 7, 2, 12, 0, 0)
  const boundaries = planDryRunBoundaries(startUtcMs)
  assert.equal(boundaries.length, 21)
  assert.deepEqual(
    boundaries.map((boundary) => boundary.offsetSeconds),
    Array.from({ length: 21 }, (_, index) => index * 15),
  )
  assert.deepEqual(
    boundaries.filter((boundary) => boundary.resource).map((boundary) => boundary.offsetSeconds),
    [0, 60, 120, 180, 240, 300],
  )
  assert.throws(() => planDryRunBoundaries(startUtcMs + 1), /exact UTC 15-second boundary/)

  const fake = createFakeSchedulerClock(startUtcMs)
  let fastSamples = 0
  let resourceSamples = 0
  const resultPromise = runBoundaryScheduler(boundaries, {
    clock: fake.clock,
    timer: fake.timer,
    launch: (boundary, lifecycle) => {
      fastSamples += 1
      if (boundary.resource) resourceSamples += 1
      lifecycle.providerComplete()
      lifecycle.parseComplete()
      lifecycle.evaluateComplete()
      lifecycle.receiptComplete()
    },
  })
  await fake.drain()
  assert.deepEqual(await resultPromise, { status: "completed" })
  assert.equal(fastSamples, 21)
  assert.equal(resourceSamples, 6)

  const latestLaunch = createFakeSchedulerClock(startUtcMs)
  latestLaunch.delayAt(startUtcMs, 250)
  const latestPromise = runBoundaryScheduler([boundaries[0]], {
    clock: latestLaunch.clock,
    timer: latestLaunch.timer,
    launch: (_boundary, lifecycle) => {
      lifecycle.providerComplete()
      lifecycle.parseComplete()
      lifecycle.evaluateComplete()
      lifecycle.receiptComplete()
    },
  })
  await latestLaunch.drain()
  assert.deepEqual(await latestPromise, { status: "completed" })

  const exact = createFakeSchedulerClock(startUtcMs)
  const exactPromise = runBoundaryScheduler([boundaries[0]], {
    clock: exact.clock,
    timer: exact.timer,
    launch: (boundary, lifecycle) => {
      exact.timer.setAt(boundary.scheduledAtUtcMs + 10_000, lifecycle.providerComplete)
      exact.timer.setAt(boundary.scheduledAtUtcMs + 12_000, lifecycle.parseComplete)
      exact.timer.setAt(boundary.scheduledAtUtcMs + 12_000, lifecycle.evaluateComplete)
      exact.timer.setAt(boundary.scheduledAtUtcMs + 12_000, lifecycle.receiptComplete)
    },
  })
  await exact.drain()
  assert.deepEqual(await exactPromise, { status: "completed" })
})
