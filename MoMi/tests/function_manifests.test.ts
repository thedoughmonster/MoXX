import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { validateArchitecture } from "../scripts/architecture/validate_architecture.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
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

  const catalog = await readFile(
    join(workspaceRoot, "docs", "service-catalog.md"),
    "utf8",
  )
  assert.equal(catalog, renderFunctionCatalog(architecture.functions))
})
