import assert from "node:assert/strict"
import test from "node:test"

import { findServiceConstitutionFindings } from
  "../scripts/constitution/find_service_constitution_findings.ts"
import { service } from "./fixtures/service_constitution_fixture.ts"

test("plural private schemas exclude foreign relation owners", () => {
  const archive = service("archive-owner")
  archive.manifest.owned_dataset!.private_schema = undefined
  archive.manifest.owned_dataset!.private_schemas = ["fixture_records"]
  const intruder = service("intruder-owner")
  intruder.manifest.owned_dataset!.private_schema = "intruder_records"
  intruder.manifest.owned_dataset!.private_relations = ["fixture_records.foreign"]
  assert.match(
    findServiceConstitutionFindings([archive, intruder])
      .map((finding) => finding.rule_id).join("\n"),
    /private_relation_schema_conflict/,
  )
})
