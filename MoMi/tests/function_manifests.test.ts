import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { functionSchemaPath, workspaceRoot } from "../scripts/architecture/paths.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { renderFunctionCatalog } from "../scripts/function_catalog.ts"

test("validates discovered services, functions, and generated catalog", async () => {
  const architecture = await validateArchitecture()
  const serviceKeys = architecture.services.map((service) =>
    service.manifest.service_key
  )
  const slugs = architecture.functions.map((loadedFunction) =>
    loadedFunction.slug
  )

  assert.ok(serviceKeys.length > 0)
  assert.equal(new Set(serviceKeys).size, serviceKeys.length)
  assert.equal(new Set(slugs).size, slugs.length)
  assert.equal(
    slugs.length,
    architecture.services.reduce(
      (count, service) => count + service.manifest.functions.length,
      0,
    ),
  )

  const loadedFunction = architecture.functions[0]
  const functionSchema = await readJson<object>(functionSchemaPath)
  const label = `${loadedFunction.slug}/function.json`
  assert.throws(
    () => validateJson(functionSchema, {
      ...loadedFunction.manifest,
      unexpected_policy_ref: "policy.example.v1",
    }, label),
    {
      message: `${label}: /unexpected_policy_ref must NOT have additional properties`,
    },
  )
  assert.throws(
    () => validateJson(functionSchema, {
      ...loadedFunction.manifest,
      probe: {
        method: "GET",
        acceptable_statuses: [401],
        unexpected_probe_option: true,
      },
    }, label),
    {
      message: `${label}: /probe/unexpected_probe_option must NOT have additional properties`,
    },
  )

  const catalog = await readFile(
    join(workspaceRoot, "docs", "service-catalog.md"),
    "utf8",
  )
  assert.equal(
    catalog,
    renderFunctionCatalog(architecture.functions, architecture.services),
  )
})
