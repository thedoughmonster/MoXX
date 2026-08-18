import assert from "node:assert/strict"
import test from "node:test"

import { findServiceAuthorityBindingViolations } from
  "../scripts/architecture/find_service_authority_binding_violations.ts"
import { loadServiceAuthorityBindingContext } from
  "../scripts/architecture/load_service_authority_binding_context.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"

const architecture = await validateArchitecture()

test("indexes the bounded canonical corpus and preserves absent authority", async () => {
  const context = await loadServiceAuthorityBindingContext(
    workspaceRoot,
    architecture.services,
    "1111111111111111111111111111111111111111",
    { grants: {} },
  )
  assert.equal(Object.keys(context.manifests).length, 30)
  assert.equal(context.debt.findings.length, 133)
  assert.deepEqual(context.executions, {})
  assert.deepEqual(
    await findServiceAuthorityBindingViolations(architecture.services), [],
  )
})
