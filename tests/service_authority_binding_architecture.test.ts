import assert from "node:assert/strict"
import test from "node:test"

import { findServiceAuthorityBindingViolations } from
  "../scripts/architecture/find_service_authority_binding_violations.ts"
import { findServiceAuthorityBindingDebtDiagnostics } from
  "../scripts/architecture/find_service_authority_binding_debt_diagnostics.ts"
import { loadServiceAuthorityBindingContext } from
  "../scripts/architecture/load_service_authority_binding_context.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"
import type { ServiceAuthorityBinding } from
  "../scripts/architecture/service_authority_binding_types.ts"

const architecture = await validateArchitecture()

test("indexes the bounded canonical corpus and preserves absent authority", async () => {
  const context = await loadServiceAuthorityBindingContext(
    workspaceRoot,
    architecture.services,
    "1111111111111111111111111111111111111111",
    { grants: {} },
  )
  assert.equal(Object.keys(context.manifests).length, 29)
  assert.equal(context.debt.findings.length, 82)
  assert.deepEqual(context.executions, {})
  assert.deepEqual(
    await findServiceAuthorityBindingViolations(architecture.services), [],
  )
  const binding = {
    service: "warehouse-projection",
    legacy_debt: {
      source_path: context.debt.source_path,
      source_schema_id: context.debt.schema_id,
      source_schema_version: "service-access-debt-baseline/v1",
      source_digest: context.debt.source_digest,
      finding_fingerprints: [],
    },
  } as unknown as ServiceAuthorityBinding
  const debt = findServiceAuthorityBindingDebtDiagnostics(binding, context)
  assert.equal(debt.filter((item) =>
    item.code === "debt_reference_incomplete").length, 25)
  assert(!debt.some((item) => item.target ===
    "sha256:029e81ce343fd3419c41d992f0c9bd0bcf8f50e2e9659a18fba45787619db579"))
  assert(debt.some((item) => item.target ===
    "sha256:fc97a449e359076b996aa44c214287226cdafe3049c8a6eb39c2277dca97110a"))
})
