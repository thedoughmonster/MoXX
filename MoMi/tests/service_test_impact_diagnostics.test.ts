import assert from "node:assert/strict"
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { findServiceTestImpactDiagnostics } from
  "../scripts/architecture/find_service_test_impact_diagnostics.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { provideServiceTestImpact } from
  "../scripts/architecture/provide_service_test_impact.ts"
import { validateArchitecture } from
  "../scripts/architecture/validate_architecture.ts"
import type { ServiceTestImpactMetadata } from
  "../scripts/architecture/service_test_impact_types.ts"
import { ServiceTestImpactError } from
  "../scripts/architecture/service_test_impact_types.ts"
import { createServiceTestImpactFixture } from
  "./service_test_impact_fixture.ts"

test("emits the complete stable fail-closed diagnostic vocabulary", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "momi-test-impact-"))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const { architecture } = await createServiceTestImpactFixture(root)
  const metadata = architecture.services[0].manifest.test_impact as
    ServiceTestImpactMetadata
  ;(metadata as unknown as { schema_version: number }).schema_version = 2
  metadata.owner_service = "wrong-owner"
  delete (metadata.categories as unknown as Record<string, unknown>)
    .provider_contract
  const mandatory = metadata.categories.mandatory_global.reverse()
  mandatory.push(structuredClone(mandatory[0]))
  const local = metadata.categories.local_unit[0]
  local.test = "../escape.test.ts"
  local.services.push("square-payment-acquisition", "zzz-unknown")
  metadata.categories.local_integration[0].test = "tests/missing.test.ts"
  const consumer = metadata.categories.consumer_contract[0]
  consumer.services.reverse()
  consumer.contracts[0] = {
    provider_service: "absent", contract: "missing.contract.v1",
  }
  const cross = metadata.categories.cross_service_integration[0]
  cross.contracts.push({
    provider_service: "preorder-operations", contract: "preorder.quote.v1",
  })
  const risk = [{
    ...metadata.categories.local_integration[0],
    id: "preorder-operations:risk_triggered:invalid:v1",
    test: "tests/escape.test.ts",
    triggers: ["runtime", "invented", "migration"],
  }, {
    ...metadata.categories.local_integration[0],
    id: "preorder-operations:risk_triggered:missing-trigger:v1",
    triggers: [],
  }] as unknown as ServiceTestImpactMetadata["categories"]["risk_triggered"]
  metadata.categories.risk_triggered = risk
  await writeFile(join(root, "outside.test.ts"), "// outside\n")
  await symlink(join(root, "outside.test.ts"), join(root, "tests/escape.test.ts"))
  const first = await findServiceTestImpactDiagnostics(
    architecture.services, root,
  )
  const second = await findServiceTestImpactDiagnostics(
    architecture.services, root,
  )
  assert.equal(canonicalJson(first), canonicalJson(second))
  const codes = new Set(first.map((item) => item.code))
  for (const code of [
    "metadata_absent", "unsupported_version", "owner_mismatch",
    "categories_missing", "selectors_unsorted", "duplicate_selector_id",
    "duplicate_selector", "invalid_test_path", "test_missing", "path_escape",
    "unknown_service", "contract_mismatch", "category_rule_mismatch",
    "invalid_trigger", "triggers_unsorted", "services_unsorted",
    "contracts_unsorted",
  ]) assert(codes.has(code as never), code)
  assert(first.some((item) => item.field === "triggers" &&
    item.code === "category_rule_mismatch" &&
    item.target === "risk trigger required"))
  await assert.rejects(() => provideServiceTestImpact(
    architecture, ["preorder-operations"], ["migration"], root,
  ), (error: unknown) => error instanceof ServiceTestImpactError)
  for (const item of first) assert.deepEqual(
    Object.keys(item).sort(),
    item.selector_id
      ? ["code", "field", "selector_id", "source", "target"]
      : ["code", "field", "source", "target"],
  )
})

test("accepts the exact preorder declaration and fails visible path drift", async () => {
  const architecture = await validateArchitecture()
  const source = "services/preorder-operations/service.json"
  const accepted = await findServiceTestImpactDiagnostics(
    architecture.services, workspaceRoot,
  )
  assert.deepEqual(accepted.filter((item) => item.source === source), [])
  const drifted = structuredClone(architecture.services)
  const preorder = drifted.find((service) =>
    service.manifest.service_key === "preorder-operations")
  assert(preorder?.manifest.test_impact)
  preorder.manifest.test_impact.categories.local_unit[0].test =
    "services/preorder-operations/tests/missing.test.ts"
  const diagnostics = await findServiceTestImpactDiagnostics(
    drifted, workspaceRoot,
  )
  assert(diagnostics.some((item) => item.source === source &&
    item.code === "test_missing"))
})
