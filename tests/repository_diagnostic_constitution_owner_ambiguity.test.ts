import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type { LoadedService } from "../scripts/architecture/types.ts"
import { finalizeFindings } from "../scripts/constitution/finalize_findings.ts"
import { constitutionDiagnostic } from
  "../scripts/diagnostics/constitution_diagnostic.ts"

function ownerService(key: string): LoadedService {
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic duplicate ownership fixture.",
      kind: "core_capability",
      lifecycle_status: "active",
      service_type: "dataset_owner",
      functions: [],
      contracts: { provides: [], consumes: [] },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
      owned_dataset: {
        dataset_key: `${key}.items`,
        dataset_class: "domain",
        private_schema: "record_data",
        private_relations: ["record_data.items_v1"],
        private_routines: ["record_data.read_item_v1"],
        public_reads: [],
        public_relation_reads: [],
        public_routine_reads: [],
        public_commands: [],
        emitted_events: [],
        db_role: `svc_${key.replaceAll("-", "_")}`,
      },
    },
  }
}

test("keeps duplicate relation and routine ownership native", () => {
  const first = ownerService("first-owner")
  const second = ownerService("second-owner")
  second.manifest.contracts.provides = [
    "second.items.read.v1",
    "second.items.routine.read.v1",
  ]
  second.manifest.owned_dataset!.public_relation_reads = [{
    contract: "second.items.read.v1",
    relation: "record_data.items_v1",
  }]
  second.manifest.owned_dataset!.public_routine_reads = [{
    contract: "second.items.routine.read.v1",
    routine: "record_data.read_item_v1",
  }]
  const findings = finalizeFindings([
    {
      rule_version: 1,
      rule_id: "direct_private_relation_access",
      subject: "services/consumer/src/read.sql",
      evidence: {
        access: "read",
        consumer_service: "consumer",
        owner_service: "second-owner",
        relation: "record_data.items_v1",
      },
      summary: "consumer reads a relation with duplicate owners.",
    },
    {
      rule_version: 1,
      rule_id: "direct_private_routine_call",
      subject: "services/consumer/src/routine.sql",
      evidence: {
        consumer_service: "consumer",
        owner_service: "second-owner",
        routine: "record_data.read_item_v1",
      },
      summary: "consumer calls a routine with duplicate owners.",
    },
  ])
  assert.deepEqual(
    findings.map((finding) => constitutionDiagnostic(finding, [first, second])),
    [null, null],
  )
})
