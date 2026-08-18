import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { readJson } from "../scripts/architecture/read_json.ts"
import { resolveServiceAuthorityBinding } from
  "../scripts/architecture/resolve_service_authority_binding.ts"
import type { ServiceAuthorityBinding } from
  "../scripts/architecture/service_authority_binding_types.ts"
import {
  bindingContext,
  bindingFixtureRoot,
  bindingSchema,
} from "./service_authority_binding_test_support.ts"

const rejections: Record<string, string[]> = {
  "copied-bodies.json": ["copied_authority_body", "schema_invalid"],
  "stale-revision-digests.json": [
    "revision_drift", "source_digest_drift", "value_digest_drift",
  ],
  "missing-sources.json": ["missing_source"],
  "runtime-as-owner.json": ["runtime_as_owner"],
  "debt-derived-authority.json": ["debt_derived_authority"],
  "unrecognized-fingerprints.json": ["unrecognized_fingerprint"],
  "service-key-fingerprint-omission.json": ["debt_reference_incomplete"],
  "execution-widening.json": ["cross_owner_target", "manifest_mismatch"],
}

for (const [name, codes] of Object.entries(rejections)) {
  test(`rejects ${name.replace(".json", "")}`, async () => {
    const binding = await readJson<ServiceAuthorityBinding>(join(
      bindingFixtureRoot, "negative", name,
    ))
    const resolution = await resolveServiceAuthorityBinding(
      binding, bindingSchema, bindingContext,
    )
    const actual = new Set(resolution.diagnostics.map((item) => item.code))
    for (const code of codes) {
      assert(actual.has(code), `${name}: ${JSON.stringify(resolution.diagnostics)}`)
    }
    assert.equal(resolution.binding, undefined)
  })
}
