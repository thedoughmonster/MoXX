import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { reconcileInventory } from "../scripts/deploy/reconcile_inventory.ts"

const architecture = {
  functions: [{ slug: "active-v1" }],
  retirements: [{
    function_slug: "old-v1",
    environments: ["dev"],
    remove_after: "2026-07-20",
  }],
} as unknown as Architecture

test("allows active functions and unexpired retirement manifests", () => {
  const hosted = [
    { slug: "active-v1", status: "ACTIVE", version: 1 },
    { slug: "old-v1", status: "ACTIVE", version: 2 },
  ]
  const result = reconcileInventory(architecture, "dev", hosted, "2026-07-13")
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.unexpected, [])
  assert.deepEqual(result.expired, [])
})

test("rejects missing, unexpected, and expired hosted functions", () => {
  const hosted = [
    { slug: "old-v1", status: "ACTIVE", version: 2 },
    { slug: "surprise-v1", status: "ACTIVE", version: 1 },
  ]
  const result = reconcileInventory(architecture, "dev", hosted, "2026-07-21")
  assert.deepEqual(result.missing, ["active-v1"])
  assert.deepEqual(result.unexpected, ["old-v1", "surprise-v1"])
  assert.deepEqual(result.expired, ["old-v1"])
})
