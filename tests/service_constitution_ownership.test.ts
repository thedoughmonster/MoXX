import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { findServiceConstitutionFindings } from
  "../scripts/constitution/find_service_constitution_findings.ts"
function service(key: string, datasetKey = `${key}.records`): LoadedService {
  const contract = "fixture.records.read.v1"
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic service constitution ownership fixture.",
      kind: "core_capability",
      service_type: "dataset_owner",
      lifecycle_status: "active",
      functions: [`${key}-v1`],
      contracts: { provides: [contract], consumes: [] },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
      owned_dataset: {
        dataset_key: datasetKey,
        dataset_class: "domain",
        private_schema: "fixture_records",
        private_relations: ["fixture_records.items"],
        private_routines: [`fixture_records.${key.replaceAll("-", "_")}_read`],
        public_reads: [contract],
        public_routine_reads: [{ contract,
          routine: `fixture_records.${key.replaceAll("-", "_")}_read` }],
        public_commands: [],
        emitted_events: ["fixture.records.changed"],
        db_role: "svc_fixture_records",
      },
    },
  }
}
test("rejects duplicate global ownership and producer declarations", () => {
  const findings = findServiceConstitutionFindings([
    service("alpha-owner", "fixture.shared"),
    service("beta-owner", "fixture.shared"),
  ])
  const rules = new Set(findings.map((finding) => finding.rule_id))
  for (const rule of [
    "dataset_key_duplicate",
    "db_role_duplicate",
    "private_schema_duplicate",
    "private_relation_duplicate",
    "contract_provider_duplicate",
    "event_producer_duplicate",
  ]) assert.ok(rules.has(rule), rule)
})
test("rejects contradictory type, dataset, and kind declarations", () => {
  const missing = service("missing-owner")
  delete missing.manifest.owned_dataset
  const untyped = service("untyped-owner")
  delete untyped.manifest.service_type
  const wrongKind = service("wrong-kind")
  wrongKind.manifest.kind = "source_adapter"
  const rules = new Set(
    findServiceConstitutionFindings([missing, untyped, wrongKind])
      .map((finding) => finding.rule_id),
  )
  assert.ok(rules.has("service_type_missing_dataset"))
  assert.ok(rules.has("owned_dataset_type_conflict"))
  assert.ok(rules.has("service_kind_type_conflict"))
})

test("requires dataset contracts to be provided by their owner", () => {
  const owner = service("contract-owner")
  owner.manifest.contracts.provides = []
  assert.match(
    findServiceConstitutionFindings([owner]).map((item) => item.rule_id).join("\n"),
    /dataset_contract_not_provided/,
  )
})

test("finding identity includes dataset and contract access mode", () => {
  const owner = service("identity-owner")
  delete owner.manifest.service_type
  owner.manifest.contracts.provides = []
  owner.manifest.owned_dataset!.public_commands = ["fixture.records.read.v1"]
  const findings = findServiceConstitutionFindings([owner])
  const conflict = findings.find((item) => item.rule_id === "owned_dataset_type_conflict")!
  const contracts = findings.filter((item) => item.rule_id === "dataset_contract_not_provided")
  assert.equal(conflict.evidence.dataset_key, "identity-owner.records")
  assert.deepEqual(
    contracts.map((item) => item.evidence.contract_kind),
    ["public_command", "public_read"],
  )
  assert.notEqual(contracts[0].fingerprint, contracts[1].fingerprint)
})

test("rejects a relation inside another owner's private schema", () => {
  const schemaOwner = service("schema-owner")
  const relationOwner = service("relation-owner")
  relationOwner.manifest.owned_dataset!.private_schema = "relation_records"
  relationOwner.manifest.owned_dataset!.private_relations = ["fixture_records.foreign"]
  assert.match(
    findServiceConstitutionFindings([schemaOwner, relationOwner])
      .map((item) => item.rule_id).join("\n"),
    /private_relation_schema_conflict/,
  )
})

test("accepts one complete unique dataset declaration", () => {
  assert.deepEqual(findServiceConstitutionFindings([service("only-owner")]), [])
})

test("accepts specialized state ownership declared by the constitution", () => {
  const archive = service("archive-owner")
  archive.manifest.service_type = "raw_evidence_archive"
  archive.manifest.owned_dataset!.dataset_class = "raw_evidence"
  assert.deepEqual(findServiceConstitutionFindings([archive]), [])
})
