import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { finalizeFindings } from "../scripts/constitution/finalize_findings.ts"
import { constitutionDiagnostic } from
  "../scripts/diagnostics/constitution_diagnostic.ts"

function ownerService(): LoadedService {
  return {
    directory: join(workspaceRoot, "services", "record-owner"),
    manifest: {
      schema_version: 1,
      service_key: "record-owner",
      purpose: "Synthetic negative diagnostic fixture.",
      kind: "core_capability",
      lifecycle_status: "active",
      service_type: "dataset_owner",
      functions: [],
      contracts: {
        provides: [
          "records.items.read.v1",
          "records.shared.first.v1",
          "records.shared.second.v1",
          "records.items.command.v1",
        ],
        consumes: [],
      },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
      owned_dataset: {
        dataset_key: "records.items",
        dataset_class: "domain",
        private_schema: "record_data",
        private_relations: ["record_data.items_v1", "record_data.shared_v1"],
        private_routines: ["record_data.replace_item_v1"],
        public_reads: [],
        public_relation_reads: [
          { contract: "records.items.read.v1", relation: "record_data.items_v1" },
          { contract: "records.shared.first.v1", relation: "record_data.shared_v1" },
          { contract: "records.shared.second.v1", relation: "record_data.shared_v1" },
        ],
        public_routine_reads: [],
        public_commands: ["records.items.command.v1"],
        public_routine_commands: [{
          contract: "records.items.command.v1",
          routine: "record_data.replace_item_v1",
        }],
        emitted_events: [],
        db_role: "svc_record_owner",
      },
    },
  }
}

test("leaves writes, mutations, and ambiguous mappings as native findings", () => {
  const findings = finalizeFindings([
    {
      rule_version: 1,
      rule_id: "direct_private_relation_access",
      subject: "services/consumer/src/write.sql",
      evidence: {
        access: "write",
        consumer_service: "consumer",
        owner_service: "record-owner",
        relation: "record_data.items_v1",
      },
      summary: "consumer directly writes the owner's relation.",
    },
    {
      rule_version: 1,
      rule_id: "direct_private_routine_mutation",
      subject: "services/consumer/src/mutate.sql",
      evidence: {
        consumer_service: "consumer",
        owner_service: "record-owner",
        routine: "record_data.replace_item_v1",
      },
      summary: "consumer mutates through the owner's private routine.",
    },
    {
      rule_version: 1,
      rule_id: "direct_private_relation_access",
      subject: "services/consumer/src/read.sql",
      evidence: {
        access: "read",
        consumer_service: "consumer",
        owner_service: "record-owner",
        relation: "record_data.shared_v1",
      },
      summary: "consumer reads a relation with multiple public mappings.",
    },
  ])
  const services = [ownerService()]
  assert.deepEqual(
    findings.map((finding) => constitutionDiagnostic(finding, services)),
    [null, null, null],
  )
})
