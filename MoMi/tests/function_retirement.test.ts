import assert from "node:assert/strict"
import test from "node:test"

import type { Architecture } from "../scripts/architecture/types.ts"
import { parseRetirementSelection } from
  "../scripts/deploy/parse_retirement_selection.ts"
import { retireFunctions } from "../scripts/deploy/retire_functions.ts"
import type { HostedFunction } from "../scripts/deploy/types.ts"

const retirement = { schema_version: 1, function_slug: "expired-v1",
  owner_service: "owner", reason: "An audited temporary caller was removed.",
  replacement: "none", environments: ["dev"], remove_after: "2026-08-08",
  removal_evidence: { issue_url: "https://linear.app/example/issue/MOX-151",
    verified_at: "2026-08-14", summary: "The owner approved removal." } }
const architecture = { functions: [], retirements: [retirement] } as unknown as Architecture
const hosted = [{ slug: "expired-v1", status: "ACTIVE", version: 1,
  verify_jwt: false, entrypoint_path: "supabase/functions/expired-v1/index.ts",
  ezbr_sha256: "a".repeat(64) }] as HostedFunction[]

test("parses an explicit deterministic retirement selection", () => {
  assert.deepEqual(parseRetirementSelection("z-v1,a-v1"), ["a-v1", "z-v1"])
  assert.throws(() => parseRetirementSelection("bad_slug"))
  assert.throws(() => parseRetirementSelection("a-v1,a-v1"))
})

test("deletes only an expired hosted function with caller evidence", () => {
  const calls: string[][] = []
  const removed = retireFunctions(architecture, "dev", "project", ["expired-v1"],
    hosted, "2026-08-14", (args) => { calls.push(args); return "" })
  assert.deepEqual(removed, ["expired-v1"])
  assert.deepEqual(calls, [["functions", "delete", "expired-v1",
    "--project-ref", "project"]])
})

test("is idempotent when the approved function is already absent", () => {
  const removed = retireFunctions(architecture, "dev", "project", ["expired-v1"],
    [], "2026-08-14", () => { throw new Error("unexpected call") })
  assert.deepEqual(removed, [])
})

test("rejects unapproved, premature, active, or cross-environment removal", () => {
  const noEvidence = { ...architecture,
    retirements: [{ ...retirement, removal_evidence: undefined }] } as Architecture
  assert.throws(() => retireFunctions(noEvidence, "dev", "project", ["expired-v1"],
    hosted, "2026-08-14"), /evidence/)
  assert.throws(() => retireFunctions(architecture, "dev", "project", ["expired-v1"],
    hosted, "2026-08-08"), /date/)
  assert.throws(() => retireFunctions({ ...architecture,
    functions: [{ slug: "expired-v1" }] } as Architecture, "dev", "project",
    ["expired-v1"], hosted, "2026-08-14"), /active/)
  assert.throws(() => retireFunctions(architecture, "prod", "project", ["expired-v1"],
    hosted, "2026-08-14"), /no prod retirement/)
})
