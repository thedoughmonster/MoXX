import assert from "node:assert/strict"
import test from "node:test"

import { buildMigrationPushPlan } from
  "../scripts/release/build_migration_push_plan.ts"

const files = [
  "20260101000000_first.sql",
  "20260102000000_second.sql",
  "20260103000000_third.sql",
  "20260104000000_fourth.sql",
]

test("keeps the default push for one exact newest migration", () => {
  const plan = buildMigrationPushPlan(
    files.slice(0, 3),
    ["20260101000000", "20260102000000"],
    ["20260103000000"],
  )
  assert.equal(plan.includeAll, false)
  assert.deepEqual(plan.missingFilenames, [files[2]])
})

test("selects include-all for one exact planned older migration", () => {
  const plan = buildMigrationPushPlan(
    files.slice(0, 3),
    ["20260102000000", "20260103000000"],
    ["20260101000000"],
  )
  assert.equal(plan.includeAll, true)
  assert.deepEqual(plan.missingVersions, ["20260101000000"])
})

test("selects include-all for multiple exact planned older migrations", () => {
  const plan = buildMigrationPushPlan(
    files,
    ["20260102000000", "20260104000000"],
    ["20260101000000", "20260103000000"],
  )
  assert.equal(plan.includeAll, true)
  assert.deepEqual(plan.missingFilenames, [files[0], files[2]])
})

test("rejects any unplanned older migration", () => {
  assert.throws(
    () => buildMigrationPushPlan(
      files.slice(0, 3),
      ["20260103000000"],
      ["20260102000000"],
    ),
    /unplanned local missing: 20260101000000/,
  )
})

test("accepts an authorized migration that is already applied", () => {
  const plan = buildMigrationPushPlan(
    files.slice(0, 2),
    ["20260101000000", "20260102000000"],
    ["20260102000000"],
  )
  assert.deepEqual(plan.missingVersions, [])
})

test("rejects an authorized migration that is not local", () => {
  assert.throws(
    () => buildMigrationPushPlan(
      files.slice(0, 2),
      ["20260101000000", "20260102000000"],
      ["20260103000000"],
    ),
    /authorized but not local: 20260103000000/,
  )
})

test("rejects hosted migration versions unknown to local history", () => {
  assert.throws(
    () => buildMigrationPushPlan(
      files.slice(0, 2),
      ["20251231000000", "20260101000000"],
      ["20260102000000"],
    ),
    /unknown local versions: 20251231000000/,
  )
})
