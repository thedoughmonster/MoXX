import assert from "node:assert/strict"
import test from "node:test"

import { classifyServiceStatus } from
  "../scripts/architecture/classify_service_status.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { renderFunctionCatalog } from "../scripts/function_catalog.ts"
import { serviceStatusManifest } from
  "./fixtures/service_status_manifest.ts"

test("derives availability for all states without inferring a missing state", () => {
  assert.deepEqual(classifyServiceStatus(), {
    implementation: "unclassified",
    availability: "not_asserted",
  })
  assert.deepEqual(classifyServiceStatus("declared"), {
    implementation: "declared",
    availability: "not_asserted",
  })
  assert.deepEqual(classifyServiceStatus("implemented"), {
    implementation: "implemented",
    availability: "not_asserted",
  })
  assert.deepEqual(classifyServiceStatus("hosted_inactive"), {
    implementation: "hosted_inactive",
    availability: "unavailable",
  })
  assert.deepEqual(classifyServiceStatus("operational"), {
    implementation: "operational",
    availability: "expected_available",
  })
})

test("renders deterministic service rows before the retained function table", () => {
  const services = [{
    directory: "zeta-service",
    manifest: {
      ...serviceStatusManifest,
      service_key: "zeta-service",
    },
  }, {
    directory: "alpha-service",
    manifest: {
      ...serviceStatusManifest,
      service_key: "alpha-service",
      implementation_status: "operational",
      functions: ["zeta-function-v1", "alpha-function-v1"],
      contracts: {
        provides: ["zeta.contract.v1", "alpha.contract.v1"],
        consumes: [],
      },
      deployment: {
        owns: [
          { kind: "queue", key: "zeta" },
          { kind: "cron_job", key: "alpha" },
        ],
        depends_on: [],
      },
    },
  }] as LoadedService[]
  const catalog = renderFunctionCatalog([], services)
  const alpha = "| `alpha-service` | active | operational | expected_available | " +
    "`alpha.contract.v1`, `zeta.contract.v1` | `alpha-function-v1`, " +
    "`zeta-function-v1` | `cron_job:alpha`, `queue:zeta` |"
  const zeta = "| `zeta-service` | active | unclassified | not_asserted | " +
    "none | none | none |"

  assert.match(
    catalog,
    /\| Service \| Lifecycle \| Implementation \| Availability \| Provides \| Functions \| Deployment \|/u,
  )
  assert.ok(catalog.indexOf(alpha) < catalog.indexOf(zeta))
  assert.ok(catalog.indexOf(zeta) < catalog.indexOf("## Edge Functions"))
  assert.match(
    catalog,
    /\| Capability \| Function key \| Purpose \| Service \| Kind \| Boundary \| Route \|/u,
  )
})
