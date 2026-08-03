import assert from "node:assert/strict"
import test from "node:test"

import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { evaluateRecoveryObservation } from "./evaluate_recovery_observation.ts"

const activation = { startedAtUtcMs: 1_785_752_000_000,
  frozen: createRecoverySnapshotFixture(), targetJobs: [], guardJobId: 20,
  generationSha256: "a".repeat(64), guardCommandSha256: "b".repeat(64) } as never

test("recovery observation accepts exact progress and recognizes zero work", () => {
  assert.deepEqual(evaluateRecoveryObservation(createRecoverySnapshotFixture(), activation),
    { stopReasons: [], zeroWork: false, progress: 1 })
  const zero = createRecoverySnapshotFixture({ toastOpen: 0, toastReady: 0,
    completedSinceStart: 2, targetRunCount: 2 })
  assert.deepEqual(evaluateRecoveryObservation(zero, activation),
    { stopReasons: [], zeroWork: true, progress: 2 })
})

test("recovery observation stops on every fail-closed evidence class", () => {
  const cases = [
    { registrySha256: "c".repeat(64) }, { registryContractViolations: 1 },
    { routingCatalogSha256: "e".repeat(64) }, { routingCatalogCount: 3 },
    { toastUnmatched: 1 }, { windowToastViolations: 1 }, { routingRetry: 1 },
    { deliveryDead: 1 }, { queueDead: 1 }, { targetRunFailures: 1 },
    { invalidTargetReturns: 1 }, { forbiddenTargetFourRuns: 1 },
    { openAttempts: 1 }, { projectionReservations: 1 }, { longLeases: 1 },
    { workerCapViolations: 1 }, { activeProjectionEdgeRouteCount: 1 },
    { waitingLocks: 1 }, { databaseBackends: 50 }, { deadlocks: 1 },
    { databaseBytes: 8_200_000_000 }, { dueAtStartRemaining: 1,
      toastOpen: 0, toastReady: 0, completedSinceStart: 2 },
  ]
  for (const changed of cases) {
    const evaluated = evaluateRecoveryObservation(createRecoverySnapshotFixture(changed), activation)
    if ("dueAtStartRemaining" in changed) assert.equal(evaluated.zeroWork, false)
    else assert.notEqual(evaluated.stopReasons.length, 0)
  }
})
