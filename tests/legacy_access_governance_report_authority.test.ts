import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { readJson } from "../scripts/architecture/read_json.ts"
import { resolveServiceAuthorityBinding } from
  "../scripts/architecture/resolve_service_authority_binding.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingContext,
} from "../scripts/architecture/service_authority_binding_types.ts"
import { validateExecutionAuthority } from
  "../scripts/architecture/validate_execution_authority.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LegacyAccessGovernanceReport } from
  "../scripts/constitution/legacy_access_governance_report_types.ts"
import {
  bindingContext, bindingFixtureRoot, bindingSchema,
} from "./service_authority_binding_test_support.ts"
import {
  context, positive, schema as executionSchema,
} from "./execution_authority_test_support.ts"
const report = await readJson<LegacyAccessGovernanceReport>(join(
  workspaceRoot, "docs", "legacy-access-governance-report.json",
))
const binding = await readJson<ServiceAuthorityBinding>(join(
  bindingFixtureRoot, "positive", "debt-referenced.json",
))
test("Service Authority Binding rejects report paths and copied rows", async () => {
  const reportPath = structuredClone(binding)
  reportPath.legacy_debt.source_path = "docs/legacy-access-governance-report.json"
  const pathResult = await resolveServiceAuthorityBinding(
    reportPath, bindingSchema, bindingContext,
  )
  assert(pathResult.diagnostics.some((item) => item.code === "schema_invalid"))
  const reportSchema = structuredClone(binding) as unknown as Record<string, unknown>
  reportSchema.legacy_debt = {
    ...binding.legacy_debt,
    source_schema_id:
      "https://momi.local/schemas/legacy-access-governance-report-v1.schema.json",
    source_schema_version: "legacy-access-governance-report/v1",
  }
  const schemaResult = await resolveServiceAuthorityBinding(
    reportSchema, bindingSchema, bindingContext,
  )
  assert(schemaResult.diagnostics.some((item) => item.code === "schema_invalid"))
  const copied = structuredClone(binding) as unknown as Record<string, unknown>
  copied.legacy_debt = report.findings[0]
  const copiedResult = await resolveServiceAuthorityBinding(
    copied, bindingSchema, bindingContext,
  )
  assert(copiedResult.diagnostics.some((item) =>
    item.code === "schema_invalid" || item.code === "copied_authority_body"))
})
test("Execution Authority rejects report references and debt authority", async () => {
  const reference = structuredClone(positive) as unknown as Record<string, unknown>
  reference.legacy_access_governance_report =
    "docs/legacy-access-governance-report.json"
  const rejected = await validateExecutionAuthority(
    reference, executionSchema, context,
  )
  assert(rejected.some((item) => item.code === "schema_invalid"))
  const row = await validateExecutionAuthority(
    report.findings[0], executionSchema, context,
  )
  assert(row.some((item) =>
    item.code === "unknown_version" || item.code === "schema_invalid"))
  const debt = structuredClone(positive)
  debt.database.read.push({ owner_service: "preorder-operations",
    object_kind: "view", qualified_object: "legacy.private_table" })
  const diagnostics = await validateExecutionAuthority(
    debt, executionSchema, context,
  )
  assert(diagnostics.some((item) => item.code === "debt_derived_authority"))
})
test("current authority results ignore report evidence context", async () => {
  const bindingWithReport = {
    ...bindingContext, legacyAccessGovernanceReport: report,
  } as unknown as ServiceAuthorityBindingContext
  assert.deepEqual(
    await resolveServiceAuthorityBinding(binding, bindingSchema, bindingWithReport),
    await resolveServiceAuthorityBinding(binding, bindingSchema, bindingContext),
  )
  const executionWithReport = {
    ...context, legacyAccessGovernanceReport: report,
  } as unknown as typeof context
  assert.deepEqual(
    await validateExecutionAuthority(positive, executionSchema, executionWithReport),
    await validateExecutionAuthority(positive, executionSchema, context),
  )
})
test("current architecture and authority surface has no report reference", async () => {
  const architectureRoot = join(workspaceRoot, "scripts", "architecture")
  const architectureNames = await readdir(architectureRoot, { recursive: true })
  const serviceRoot = join(workspaceRoot, "services")
  const manifestNames = (await readdir(serviceRoot, { recursive: true })).filter(
    (name) => name.endsWith("service.json") || name.endsWith("function.json"),
  )
  const schemaRoot = join(workspaceRoot, "schemas")
  const schemaNames = (await readdir(schemaRoot)).filter((name) =>
    name !== "legacy-access-governance-report-v1.schema.json")
  const contractRoot = join(workspaceRoot, "docs", "contracts")
  const contractNames = (await readdir(contractRoot)).filter((name) =>
    name !== "legacy-access-governance-report-v1.md")
  const explicitNames = [
    "scripts/check_architecture.ts", "workspace.json", "docs/architecture.md",
    "docs/service-access-debt-baseline.json",
  ]
  const contents = await Promise.all([
    ...architectureNames.map((name) =>
      readFile(join(architectureRoot, name), "utf8")),
    ...manifestNames.map((name) => readFile(join(serviceRoot, name), "utf8")),
    ...schemaNames.map((name) => readFile(join(schemaRoot, name), "utf8")),
    ...contractNames.map((name) => readFile(join(contractRoot, name), "utf8")),
    ...explicitNames.map((name) => readFile(join(workspaceRoot, name), "utf8")),
  ])
  assert.equal(contents.some((text) =>
    text.includes("legacy-access-governance-report") ||
    text.includes("legacy_access_governance_report")), false)
})
