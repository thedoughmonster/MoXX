import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import type { ImplementationStatus } from
  "../scripts/architecture/service_manifest_types.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { findServiceStatusViolations } from
  "../scripts/architecture/find_service_status_violations.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import { serviceStatusManifest } from
  "./fixtures/service_status_manifest.ts"

const schema = JSON.parse(await readFile(
  join(workspaceRoot, "schemas", "service-manifest-v1.schema.json"),
  "utf8",
))
const statuses: ImplementationStatus[] = [
  "declared",
  "implemented",
  "hosted_inactive",
  "operational",
]

test("accepts every implementation state on active and retiring services", () => {
  for (const lifecycle_status of ["active", "retiring"]) {
    for (const implementation_status of statuses) {
      assert.doesNotThrow(() => validateJson(schema, {
        ...serviceStatusManifest,
        lifecycle_status,
        implementation_status,
      }, "fixture"))
    }
  }
})

test("rejects retired operational with exact service and field diagnostics", () => {
  for (const implementation_status of statuses) {
    const services = [{
      directory: "status-fixture",
      manifest: {
        ...serviceStatusManifest,
        lifecycle_status: "retired",
        implementation_status,
      },
    }] as LoadedService[]
    const expected = implementation_status === "operational"
      ? [
        "status-fixture/service.json: /implementation_status operational " +
          "is forbidden when /lifecycle_status is retired",
      ]
      : []
    assert.deepEqual(findServiceStatusViolations(services), expected)
  }
})

test("keeps a missing implementation state unclassified and rejects unknowns", () => {
  assert.doesNotThrow(() => validateJson(
    schema,
    serviceStatusManifest,
    "fixture",
  ))
  assert.throws(() => validateJson(schema, {
    ...serviceStatusManifest,
    implementation_status: "hosted",
  }, "fixture"), /fixture: \/implementation_status/u)
})

test("documents evidence gates and guarded transitions normatively", async () => {
  const contract = await readFile(join(
    workspaceRoot,
    "docs",
    "contracts",
    "service-status-v1.md",
  ), "utf8")
  assert.match(
    contract,
    /`declared` → `implemented` → `hosted_inactive` →\n`operational`/u,
  )
  assert.match(contract, /same\n  artifact and environment/u)
  assert.match(contract, /named existing consumers only; no new consumers/u)
  assert.match(contract, /`retired` is terminal\nfor the same contract version/u)
  assert.match(contract, /non-authoritative recommendations/u)
  assert.match(contract, /None becomes `operational` without exact environment proof/u)
})
