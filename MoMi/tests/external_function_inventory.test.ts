import assert from "node:assert/strict"
import test from "node:test"

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
  functions: [],
  retirements: [],
  externalFunctionAuthorities: [{
    function_slug: "external-v1",
    lifecycle_status: "active",
    owner_repository: "thedoughmonster/momi-symphony",
    environments: [{ name: "dev", project_ref: "xtbraqnlskmqxinjxxdn" }],
    adapter_path: "supabase/functions/external-v1/index.ts",
    verify_jwt: false,
  }],
} as unknown as Architecture

test("requires externally owned functions with owner-bound hosted metadata", () => {
  const hosted = [{
    ...hostedFunction("external-v1"),
    entrypoint_path:
      "file:///home/runner/work/momi-symphony/momi-symphony/supabase/functions/external-v1/index.ts",
  }]
  const result = reconcileInventory(architecture, "dev", hosted, "2026-07-21")
  assert.deepEqual(result.externally_owned, ["external-v1"])
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.unexpected, [])
  assert.deepEqual(result.invalid_metadata, [])
})

test("retired retained functions remain required with strict hosted metadata", () => {
  const retained = {
    ...architecture,
    externalFunctionAuthorities: architecture.externalFunctionAuthorities.map((item) => ({
      ...item, lifecycle_status: "retired_retained",
    })),
  } as Architecture
  const absent = reconcileInventory(retained, "dev", [], "2026-07-21")
  assert.deepEqual(absent.missing, ["external-v1"])
  assert.deepEqual(absent.retired, [])
  const invalid = reconcileInventory(retained, "dev", [{
    ...hostedFunction("external-v1"), status: "REMOVED", ezbr_sha256: null,
  }], "2026-07-21")
  assert.ok(invalid.invalid_metadata.some((item) => item.includes("status must be ACTIVE")))
  assert.ok(invalid.invalid_metadata.some((item) => item.includes("entrypoint_path")))
  assert.ok(invalid.invalid_metadata.some((item) => item.includes("bundle hash")))
})

test("rejects missing or mismatched externally owned functions", () => {
  const invalid = reconcileInventory(architecture, "dev", [{
    ...hostedFunction("external-v1"),
    entrypoint_path: "supabase/functions/external-v1/index.ts",
    verify_jwt: true,
  }], "2026-07-21")
  assert.deepEqual(invalid.invalid_metadata, [
    "external-v1: entrypoint_path must end with momi-symphony/momi-symphony/supabase/functions/external-v1/index.ts, found supabase/functions/external-v1/index.ts",
    "external-v1: verify_jwt must match authority (false), found true",
  ])
  assert.deepEqual(
    reconcileInventory(architecture, "dev", [], "2026-07-21").missing,
    ["external-v1"],
  )
})
