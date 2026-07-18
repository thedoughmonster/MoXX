import assert from "node:assert/strict"
import test from "node:test"

import { findServiceConstitutionFindings } from
  "../scripts/constitution/find_service_constitution_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("constrains dataset classes by service type", () => {
  const procurement = service("procurement-owner")
  procurement.manifest.service_type = "procurement_adapter"
  procurement.manifest.kind = "source_adapter"
  const router = service("router-owner")
  router.manifest.service_type = "event_router"
  delete router.manifest.owned_dataset
  const rules = findServiceConstitutionFindings([procurement, router])
    .map((finding) => finding.rule_id)
  assert.ok(rules.includes("dataset_class_type_conflict"))
  assert.ok(rules.includes("service_type_missing_dataset"))
})
