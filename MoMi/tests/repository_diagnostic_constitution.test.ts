import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { findBaselineViolations } from
  "../scripts/constitution/find_baseline_violations.ts"
import { findRuntimeAccessFindings } from
  "../scripts/constitution/find_runtime_access_findings.ts"
import { findServiceConstitutionFindings } from
  "../scripts/constitution/find_service_constitution_findings.ts"
import { constitutionDiagnostic } from
  "../scripts/diagnostics/constitution_diagnostic.ts"
import { renderConstitutionViolationReport } from
  "../scripts/diagnostics/render_constitution_violation_report.ts"

function service(key: string): LoadedService {
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic diagnostic adapter fixture.",
      kind: "core_capability",
      lifecycle_status: "active",
      functions: [],
      contracts: { provides: [], consumes: [] },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
    },
  }
}

test("resolves the exact current owner and public contract from manifests", () => {
  const owner = service("record-owner")
  owner.manifest.service_type = "dataset_owner"
  owner.manifest.contracts.provides = ["records.items.read.v1"]
  owner.manifest.owned_dataset = {
    dataset_key: "records.items",
    dataset_class: "domain",
    private_schema: "record_data",
    private_relations: ["record_data.items_v1"],
    private_routines: [],
    public_reads: ["records.items.read.v1"],
    public_relation_reads: [{
      contract: "records.items.read.v1",
      relation: "record_data.items_v1",
    }],
    public_routine_reads: [],
    public_commands: [],
    emitted_events: [],
    db_role: "svc_record_owner",
  }
  const consumer = service("record-consumer")
  const findings = findRuntimeAccessFindings([owner, consumer], [{
    path: join(consumer.directory, "src", "read.sql"),
    service_key: "record-consumer",
    source: "select * from record_data.items_v1",
    imports: [],
  }])
  const finding = findings.find((item) =>
    item.rule_id === "direct_private_relation_access")!
  const diagnostic = constitutionDiagnostic(finding, [owner, consumer])!
  assert.equal(diagnostic.rule_id, finding.rule_id)
  assert.match(diagnostic.expected, /record-owner's records\.items\.read\.v1/u)
  assert.match(diagnostic.expected, /services\/record-consumer\/service\.json/u)
  assert.deepEqual(diagnostic.repair, { kind: "none" })
  const violations = findBaselineViolations(findings, {
    $schema: "fixture",
    schema_version: 1,
    generated_from: "fixture",
    notes: [],
    findings: [],
  }, new Set())
  assert.match(
    renderConstitutionViolationReport(violations, findings, [owner, consumer]),
    /direct_private_relation_access/u,
  )
})

test("keeps ambiguous ownership and absent-contract decisions native", () => {
  const first = service("first-owner")
  const second = service("second-owner")
  for (const owner of [first, second]) {
    owner.manifest.service_type = "dataset_owner"
    owner.manifest.owned_dataset = {
      dataset_key: "shared.records",
      dataset_class: "domain",
      private_schema: `${owner.manifest.service_key.replaceAll("-", "_")}_data`,
      private_relations: [],
      private_routines: [],
      public_reads: [],
      public_routine_reads: [],
      public_commands: [],
      emitted_events: [],
      db_role: `svc_${owner.manifest.service_key.replaceAll("-", "_")}`,
    }
  }
  first.manifest.owned_dataset!.private_relations = [
    `${first.manifest.owned_dataset!.private_schema}.hidden`,
  ]
  const duplicate = findServiceConstitutionFindings([first, second])
    .find((item) => item.rule_id === "dataset_key_duplicate")!
  assert.equal(constitutionDiagnostic(duplicate, [first, second]), null)

  const consumer = service("consumer")
  const privateFinding = findRuntimeAccessFindings([first, consumer], [{
    path: join(consumer.directory, "src", "read.sql"),
    service_key: "consumer",
    source: `select * from ${first.manifest.owned_dataset!.private_schema}.hidden`,
    imports: [],
  }])[0]
  assert.equal(privateFinding.rule_id, "direct_private_relation_access")
  assert.equal(constitutionDiagnostic(privateFinding, [first, consumer]), null)
})
