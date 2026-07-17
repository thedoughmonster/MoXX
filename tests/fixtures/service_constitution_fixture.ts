import { join } from "node:path"

import { workspaceRoot } from "../../scripts/architecture/paths.ts"
import type { LoadedService } from "../../scripts/architecture/types.ts"

export function service(key: string): LoadedService {
  const contract = "fixture.records.read.v1"
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic service constitution inventory fixture.",
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
        dataset_key: `${key}.records`,
        private_schema: "fixture_records",
        private_relations: ["fixture_records.items"],
        public_reads: [contract],
        public_commands: [],
        emitted_events: [],
      },
    },
  }
}
