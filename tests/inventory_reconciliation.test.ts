import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { Architecture } from "../scripts/architecture/types.ts"
import { reconcileInventory } from "../scripts/deploy/reconcile_inventory.ts"
import type { HostedFunction } from "../scripts/deploy/types.ts"

function hostedFunction(slug: string): HostedFunction {
  return {
    slug,
    status: "ACTIVE",
    version: 1,
    verify_jwt: false,
    entrypoint_path:
      `file:///tmp/deployed/source/supabase/functions/${slug}/index.ts`,
    ezbr_sha256: "a".repeat(64),
  }
}

const architecture = {
  functions: [{
    slug: "active-v1",
    adapter_directory: join(workspaceRoot, "supabase", "functions", "active-v1"),
  }],
  retirements: [{
    function_slug: "old-v1",
    environments: ["dev"],
    remove_after: "2026-07-20",
  }],
  externalFunctionAuthorities: [],
} as unknown as Architecture

test("allows active functions and unexpired retirement manifests", () => {
  const hosted = [
    hostedFunction("active-v1"),
    { ...hostedFunction("old-v1"), version: 2 },
  ]
  const result = reconcileInventory(
    architecture,
    "dev",
    hosted,
    "2026-07-13",
    new Map([["active-v1", false]]),
  )
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.unexpected, [])
  assert.deepEqual(result.expired, [])
  assert.deepEqual(result.invalid_metadata, [])
})

test("rejects missing, unexpected, and expired hosted functions", () => {
  const hosted = [
    { ...hostedFunction("old-v1"), version: 2 },
    hostedFunction("surprise-v1"),
  ]
  const result = reconcileInventory(
    architecture,
    "dev",
    hosted,
    "2026-07-21",
    new Map([["active-v1", false]]),
  )
  assert.deepEqual(result.missing, ["active-v1"])
  assert.deepEqual(result.unexpected, ["old-v1", "surprise-v1"])
  assert.deepEqual(result.expired, ["old-v1"])
  assert.deepEqual(result.invalid_metadata, [])
})

test("clears an expired retirement after its hosted function is removed", () => {
  const result = reconcileInventory(
    architecture,
    "dev",
    [hostedFunction("active-v1")],
    "2026-07-21",
    new Map([["active-v1", false]]),
  )
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.unexpected, [])
  assert.deepEqual(result.expired, [])
  assert.deepEqual(result.invalid_metadata, [])
})

test("reports every invalid active hosted function attestation deterministically", () => {
  const result = reconcileInventory(architecture, "dev", [{
    ...hostedFunction("active-v1"),
    status: "THROTTLED",
    version: 0,
    verify_jwt: true,
    entrypoint_path: "index.ts",
    ezbr_sha256: "invalid",
  }], "2026-07-13", new Map([["active-v1", false]]))
  assert.deepEqual(result.invalid_metadata, [
    "active-v1: hosted status must be ACTIVE, found THROTTLED",
    "active-v1: hosted version must be greater than zero",
    "active-v1: entrypoint_path must be supabase/functions/active-v1/index.ts, found index.ts",
    "active-v1: ezbr_sha256 must be a 64-hex hosted bundle hash",
    "active-v1: verify_jwt must match config (false), found true",
  ])
})
