import assert from "node:assert/strict"
import test from "node:test"

import { createRecoverySnapshotFixture } from "./create_recovery_snapshot.test_fixture.ts"
import { evaluateRecoveryObservation } from "./evaluate_recovery_observation.ts"
import { generateRecoveryBoundaryConfigSql } from "./generate_recovery_boundary_config_sql.ts"
import { generateRecoveryObservationSql } from "./generate_recovery_observation_sql.ts"
import { VALID_GUARD_HEARTBEAT_INPUT } from "./guard_heartbeat.test_fixture.ts"
import { hasRecoveryMembershipDrift } from "./has_recovery_membership_drift.ts"
import { loadRecoverySnapshotSql } from "./load_recovery_snapshot_sql.ts"
import { parseRecoverySnapshot } from "./parse_recovery_snapshot.ts"
import { RECOVERY_SNAPSHOT_KEYS } from "./recovery_snapshot_keys.ts"
import { validateRecoveryPreflight } from "./validate_recovery_preflight.ts"

const activation = { startedAtUtcMs: 1_785_752_000_000,
  frozen: createRecoverySnapshotFixture(), targetJobs: [], guardJobId: 20,
  generationSha256: "a".repeat(64), guardCommandSha256: "b".repeat(64) } as never

test("snapshot freezes every accepted durable root and deterministic descendant join", () => {
  const sql = loadRecoverySnapshotSql()
  for (const contract of [
    /job_id <= b\.job_high_water and j\.created_at <= b\.started_at/,
    /j\.completed_at is null or j\.completed_at >= b\.started_at/,
    /split_part\(j\.idempotency_key, ':', 2\) = parent\.job_id::text/,
    /cohort_observations.*join toast_raw\.resource_observations/s,
    /join source_observation_events e using \(observation_id\)/,
    /join projector_parent_candidates child on child\.parent_event_id = parent\.event_id/,
    /join momi_events\.routing_work r using \(event_id\)/,
    /join momi_events\.deliveries d using \(event_id\)/,
    /using \(event_id, subscription_key\)/,
    /'queue', event_id::text \|\| ':' \|\| subscription_key/,
    /where status in \('queued', 'running', 'delivered'\)/,
    /from pgmq\.q_warehouse_projection_toast_v1 q/,
    /from pgmq\.q_order_alerting_v1 q/,
    /prior_membership_proof_rows as/,
    /not exists \(select 1 from cohort_membership_proof_rows current/,
    /prior_lineage_proof_rows as/,
    /current\.parent_sha256 <> prior\.parent_sha256/,
    /'cohortChangedParentCount', lineage_delta\.changed_parent_rows/,
  ]) assert.match(sql, contract)
  assert.doesNotMatch(sql,
    /\b(insert|update|delete|alter|drop|create|truncate|lock|call)\b|jsonb_object_length/i)
})

test("observation reuses only the frozen private boundary input", () => {
  const frozen = createRecoverySnapshotFixture({ dueOccurrences: [
    { scheduleKey: "toast.stock.interval", dueAtUtcMs: 1_785_751_900_000 },
  ] })
  const config = generateRecoveryBoundaryConfigSql(frozen)
  assert.match(config, /^select set_config\('momi\.recovery_boundary'/)
  assert.doesNotMatch(config, /toast\.stock\.interval/)
  const sql = generateRecoveryObservationSql(VALID_GUARD_HEARTBEAT_INPUT,
    { ...activation, frozen } as never, false)
  assert.match(sql, /set_config\('momi\.recovery_boundary'/)
  assert.match(sql, /with recovery_snapshot as/)
})

test("continuous independent arrivals cannot move the cohort deadline", () => {
  for (let sample = 1; sample <= 8; sample += 1) {
    const observation = createRecoverySnapshotFixture({
      cohortJobOpen: 0, cohortEmittableParents: 0, cohortTerminalCount: 9,
      toastOpen: 100 + sample, toastReady: 100 + sample,
      routingOpen: 200 + sample, routingReady: 200 + sample,
      deliveryOpen: 300 + sample, deliveryReady: 300 + sample,
      queueReady: 400 + sample, openAttempts: sample,
      projectionReservations: sample,
    })
    const result = evaluateRecoveryObservation(observation, activation)
    assert.deepEqual(result, { stopReasons: [], zeroWork: true, progress: 9 })
  }
})

test("boundary drift and ambiguous descendants fail closed", () => {
  for (const changed of [{ cohortBoundarySha256: "f".repeat(64) },
    { cohortRootCount: 2 }, { cohortRootSha256: "f".repeat(64) },
    { cohortAmbiguous: 1 }, { cohortInvalid: 1 }]) {
    assert.notEqual(evaluateRecoveryObservation(
      createRecoverySnapshotFixture(changed), activation).stopReasons.length, 0)
  }
})

test("durable membership and lineage may grow but never shrink or rewrite", () => {
  const state = { lastMembershipCount: 4, lastMembershipSha256: "a".repeat(64),
    lastLineageEdgeCount: 3, lastLineageEdgeSha256: "b".repeat(64) }
  assert.equal(hasRecoveryMembershipDrift(createRecoverySnapshotFixture({
    cohortMembershipCount: 5, cohortMembershipSha256: "c".repeat(64),
    cohortLineageEdgeCount: 4, cohortLineageEdgeSha256: "d".repeat(64),
  }), state), false)
  assert.equal(hasRecoveryMembershipDrift(createRecoverySnapshotFixture({
    cohortMembershipCount: 8, cohortMembershipSha256: "c".repeat(64),
    cohortLineageEdgeCount: 7, cohortLineageEdgeSha256: "d".repeat(64),
    cohortMissingPriorMemberCount: 1, cohortMissingPriorLineageEdgeCount: 1,
    cohortChangedParentCount: 1,
  }), state), true)
  for (const change of [{ cohortMembershipCount: 3 },
    { cohortMembershipCount: 4, cohortMembershipSha256: "e".repeat(64) },
    { cohortLineageEdgeCount: 2 },
    { cohortLineageEdgeCount: 3, cohortLineageEdgeSha256: "f".repeat(64) }]) {
    assert.equal(hasRecoveryMembershipDrift(
      createRecoverySnapshotFixture({ cohortMembershipCount: 4,
        cohortMembershipSha256: "a".repeat(64), cohortLineageEdgeCount: 3,
        cohortLineageEdgeSha256: "b".repeat(64), ...change }), state), true)
  }
})

test("boundary parser rejects malformed, duplicate, and reordered occurrences", () => {
  const raw = createRecoverySnapshotFixture()
  const snapshot = Object.fromEntries(RECOVERY_SNAPSHOT_KEYS.map((key) => [key, raw[key]]))
  for (const dueOccurrences of [
    [{ scheduleKey: "unsafe key", dueAtUtcMs: 1 }],
    [{ scheduleKey: "b", dueAtUtcMs: 1 }, { scheduleKey: "a", dueAtUtcMs: 1 }],
    [{ scheduleKey: "a", dueAtUtcMs: 1 }, { scheduleKey: "a", dueAtUtcMs: 1 }],
    [{ scheduleKey: "a", dueAtUtcMs: -1 }],
    [{ scheduleKey: "a", dueAtUtcMs: 1, extra: true }],
  ]) assert.throws(() => parseRecoverySnapshot({ ...snapshot, dueOccurrences }))
  assert.throws(() => parseRecoverySnapshot({ ...snapshot,
    cohortMembershipProof: ["b".repeat(64), "a".repeat(64)] }))
  assert.throws(() => parseRecoverySnapshot({ ...snapshot,
    cohortLineageProof: [{ childSha256: "a".repeat(64),
      parentSha256: "b".repeat(64), edgeSha256: "not-a-hash" }] }))
})

test("preflight requires complete global-to-cohort root coverage", () => {
  const sample = createRecoverySnapshotFixture({ guardIdentityCount: 0,
    targetJobs: createRecoverySnapshotFixture().targetJobs.map((job) =>
      ({ ...job, active: false })) })
  assert.equal(validateRecoveryPreflight(sample), sample)
  for (const changed of [{ cohortJobOpen: 0 }, { cohortRoutingOpen: 1 },
    { cohortDeliveryOpen: 1 }, { cohortQueueOpen: 1 },
    { cohortMembershipCount: 0 }, { cohortAmbiguous: 1 }]) {
    assert.throws(() => validateRecoveryPreflight({ ...sample, ...changed }))
  }
})
