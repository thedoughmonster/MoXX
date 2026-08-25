import assert from "node:assert/strict"
import test from "node:test"

import type { ExternalFunctionAuthority } from
  "../scripts/architecture/external_function_authority_types.ts"
import { findExternalFunctionAuthorityConflicts } from
  "../scripts/architecture/find_external_function_authority_conflicts.ts"
import { findExternalFunctionAuthorityValidityViolations } from
  "../scripts/architecture/find_external_function_authority_validity_violations.ts"
import type { LoadedFunction, RetirementManifest } from
  "../scripts/architecture/types.ts"

const authority = {
  function_slug: "external-v1",
  verified_at: "2026-08-23",
  valid_until: "2026-09-22",
  environments: [{ name: "dev" }],
} as ExternalFunctionAuthority

test("external authority must be current and chronologically valid", () => {
  assert.deepEqual(
    findExternalFunctionAuthorityValidityViolations([authority], "2026-09-22"),
    [],
  )
  assert.deepEqual(findExternalFunctionAuthorityValidityViolations(
    [{ ...authority, verified_at: "2026-02-30", valid_until: "2026-02-28" }],
    "2026-08-23",
  ), [
    "external-v1: valid_until cannot precede verified_at",
    "external-v1: verified_at must be a valid calendar date",
  ])
  assert.deepEqual(
    findExternalFunctionAuthorityValidityViolations([authority], "2026-09-23"),
    ["external-v1: external authority expired 2026-09-22"],
  )
  assert.deepEqual(findExternalFunctionAuthorityValidityViolations(
    [{ ...authority, verified_at: "2026-08-24" }], "2026-08-23"
  ), ["external-v1: verified_at cannot be in the future"])
})

test("external authority cannot overlap local or retirement authority", () => {
  const local = [{ slug: "external-v1" }] as LoadedFunction[]
  const retirement = [{ function_slug: "external-v1", environments: ["dev"] }] as
    unknown as RetirementManifest[]
  assert.deepEqual(
    findExternalFunctionAuthorityConflicts([authority], retirement, local),
    [
      "external-v1: cannot be externally owned and retiring",
      "external-v1: cannot be locally and externally owned",
    ],
  )
})
