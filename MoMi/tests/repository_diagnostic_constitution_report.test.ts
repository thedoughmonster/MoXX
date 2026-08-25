import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { finalizeFindings } from "../scripts/constitution/finalize_findings.ts"
import { constitutionDiagnostic } from
  "../scripts/diagnostics/constitution_diagnostic.ts"
import { renderConstitutionViolationReport } from
  "../scripts/diagnostics/render_constitution_violation_report.ts"

function ownerService(): LoadedService {
  return {
    directory: join(workspaceRoot, "services", "record-owner"),
    manifest: {
      schema_version: 1,
      service_key: "record-owner",
      purpose: "Synthetic constitution report fixture.",
      kind: "core_capability",
      lifecycle_status: "active",
      service_type: "dataset_owner",
      functions: [],
      contracts: { provides: ["records.items.read.v1"], consumes: [] },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
      owned_dataset: {
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
      },
    },
  }
}

test("retains database locations and unrelated native violations", () => {
  const subjects = [
    "database/routines/record_data.read_items_v1--abc123.sql",
    "database/views/record_data.items_public_v1.sql",
  ]
  const findings = finalizeFindings(subjects.map((subject) => ({
    rule_version: 1 as const,
    rule_id: "direct_private_relation_access",
    subject,
    evidence: {
      access: "read",
      consumer_service: "consumer",
      owner_service: "record-owner",
      relation: "record_data.items_v1",
    },
    summary: "consumer directly reads record-owner's relation.",
  })))
  const violations = findings.map((finding) =>
    `new ${finding.rule_id}: ${finding.subject}: ${finding.summary} ` +
      `(${finding.fingerprint})`
  )
  violations.push(
    `${findings[0].subject}: duplicate current finding identity ` +
      findings[0].fingerprint,
  )
  const output = renderConstitutionViolationReport(
    violations, findings, [ownerService()],
  )
  assert.match(output, /direct_private_relation_access \(2 instances;/u)
  for (const subject of subjects) assert.match(output, new RegExp(subject, "u"))
  assert.match(output, /Unadapted violations:\n- .*duplicate current finding identity/u)

  const missing = finalizeFindings([{
    rule_version: 1,
    rule_id: "dataset_contract_not_provided",
    subject: "contract:records.items.read.v1",
    evidence: {
      contract: "records.items.read.v1",
      service_key: "record-owner",
    },
    summary: "record-owner does not provide its dataset contract.",
  }])[0]
  assert.equal(
    constitutionDiagnostic(missing, [ownerService()])?.location?.path,
    "services/record-owner/service.json",
  )
})
