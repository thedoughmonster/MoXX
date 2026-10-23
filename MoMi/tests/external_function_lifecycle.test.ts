import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import type { ExternalFunctionAuthority } from
  "../scripts/architecture/external_function_authority_types.ts"
import { findExternalFunctionAuthorityValidityViolations } from
  "../scripts/architecture/find_external_function_authority_validity_violations.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"

const schema = JSON.parse(readFileSync(new URL(
  "../schemas/external-function-authority-v1.schema.json", import.meta.url,
), "utf8"))
const active: ExternalFunctionAuthority = {
  schema_version: 1,
  function_slug: "external-v1",
  owner_repository: "example/retained-owner",
  owner_service: "external-service",
  lifecycle_status: "active",
  environments: [{ name: "dev", project_ref: "a".repeat(20) }],
  deployment_workflow: ".github/workflows/deploy-dev.yml",
  adapter_path: "supabase/functions/external-v1/index.ts",
  verify_jwt: false,
  source_revision: "1".repeat(40),
  verified_at: "2026-10-21",
  valid_until: "2026-11-20",
  caller: { kind: "database_trigger", state: "active", evidence_url: "https://example.org/evidence" },
}
const retained: ExternalFunctionAuthority = {
  ...active,
  lifecycle_status: "retired_retained",
  caller: { ...active.caller, state: "policy_disabled" },
  retirement: {
    source_revision: "2".repeat(40),
    verified_at: "2026-10-20",
    evidence_url: "https://github.com/example/retained-owner/actions/runs/123",
  },
}

test("retained lifecycle requires separate owner evidence and disabled policies", () => {
  assert.doesNotThrow(() => validateJson(schema, active, "active"))
  assert.doesNotThrow(() => validateJson(schema, retained, "retained"))
  assert.throws(() => validateJson(schema, {
    ...retained, retirement: undefined,
  }, "missing evidence"))
  assert.throws(() => validateJson(schema, {
    ...retained, caller: active.caller,
  }, "active caller"))
  assert.throws(() => validateJson(schema, {
    ...active, retirement: retained.retirement,
  }, "active with retirement"))
  assert.throws(() => validateJson(schema, {
    ...retained, retirement: { ...retained.retirement, source_revision: "main" },
  }, "mutable source"))
})

test("retained authority has the same expiry requirement as active authority", () => {
  for (const authority of [active, retained]) {
    assert.deepEqual(findExternalFunctionAuthorityValidityViolations(
      [authority], "2026-11-20",
    ), [])
    assert.deepEqual(findExternalFunctionAuthorityValidityViolations(
      [authority], "2026-11-21",
    ), ["external-v1: external authority expired 2026-11-20"])
  }
})

test("retirement verification must predate authority verification and use real dates", () => {
  assert.deepEqual(findExternalFunctionAuthorityValidityViolations([{
    ...retained, retirement: { ...retained.retirement, verified_at: "2026-10-22" },
  }], "2026-10-21"), [
    "external-v1: retirement verification cannot follow authority verification",
  ])
  assert.deepEqual(findExternalFunctionAuthorityValidityViolations([{
    ...retained, retirement: { ...retained.retirement, verified_at: "2026-02-30" },
  }], "2026-10-21"), [
    "external-v1: retirement.verified_at must be a valid calendar date",
  ])
})

test("retirement evidence is bound to the owner repository and a workflow run", () => {
  for (const evidence_url of [
    "https://github.com/example/another-owner/actions/runs/123",
    "https://github.com/example/retained-owner/actions/runs/123?redirect=other",
    "https://github.com/example/retained-owner/actions/runs/123/attempts/1",
    "https://github.com/example/retained-owner/pull/123",
  ]) {
    assert.deepEqual(findExternalFunctionAuthorityValidityViolations([{
      ...retained, retirement: { ...retained.retirement, evidence_url },
    }], "2026-10-21"), [
      "external-v1: retirement evidence must identify an owner workflow run",
    ])
  }
})
