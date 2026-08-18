import assert from "node:assert/strict"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { digestServiceAuthorityBinding } from
  "../scripts/architecture/digest_service_authority_binding.ts"
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

const positiveDirectory = join(bindingFixtureRoot, "positive")
const positiveNames = (await readdir(positiveDirectory)).sort()

test("accepts every four-layer positive fixture", async () => {
  assert.deepEqual(positiveNames, [
    "debt-referenced.json", "exact-execution.json", "no-dataset.json",
    "no-debt.json", "owner.json", "zero-execution.json",
  ])
  for (const name of positiveNames) {
    const binding = await readJson<ServiceAuthorityBinding>(join(
      positiveDirectory, name,
    ))
    const resolution = await resolveServiceAuthorityBinding(
      binding, bindingSchema, bindingContext,
    )
    assert.deepEqual(resolution.diagnostics, [],
      `${name}: ${JSON.stringify(resolution.diagnostics)}`)
    assert.equal(resolution.binding, binding)
  }
})

test("binds canonical content without trusting schema location", async () => {
  const binding = await readJson<ServiceAuthorityBinding>(join(
    positiveDirectory, "owner.json",
  ))
  const reordered = Object.fromEntries(
    Object.entries(structuredClone(binding)).reverse(),
  ) as unknown as ServiceAuthorityBinding
  reordered.$schema = "another-schema-location"
  assert.equal(
    digestServiceAuthorityBinding(reordered), binding.binding_digest,
  )
  reordered.service = "fixture-no-dataset"
  assert.notEqual(
    digestServiceAuthorityBinding(reordered), binding.binding_digest,
  )
})

test("emits deterministic source-identity diagnostics", async () => {
  const binding = await readJson<ServiceAuthorityBinding>(join(
    bindingFixtureRoot, "negative", "stale-revision-digests.json",
  ))
  const first = await resolveServiceAuthorityBinding(
    binding, bindingSchema, bindingContext,
  )
  const second = await resolveServiceAuthorityBinding(
    binding, bindingSchema, bindingContext,
  )
  assert.deepEqual(first, second)
  assert(first.diagnostics.every((item) =>
    !item.message.includes("fixture baseline is removal-only")))
})
