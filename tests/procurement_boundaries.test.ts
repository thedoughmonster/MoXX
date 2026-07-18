import assert from "node:assert/strict"
import test from "node:test"

import { findDatasetClassFindings } from
  "../scripts/constitution/find_dataset_class_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("procurement adapters cannot depend on MoMi-owned contracts", () => {
  const procurement = service("source-procurement")
  procurement.manifest.kind = "source_adapter"
  procurement.manifest.service_type = "procurement_adapter"
  procurement.manifest.owned_dataset!.dataset_class = "operational"
  procurement.manifest.contracts.consumes = [{
    service: "records-owner",
    contract: "fixture.records.read.v1",
  }]
  assert.deepEqual(
    findDatasetClassFindings([procurement]).map((finding) => finding.rule_id),
    ["procurement_internal_contract_dependency"],
  )
})
