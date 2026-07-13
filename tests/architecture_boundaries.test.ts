import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"

import type { ConsumedContract, LoadedService } from "../scripts/architecture/types.ts"
import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { findImportBoundaryViolations } from "../scripts/architecture/find_import_boundary_violations.ts"
import { findServiceGraphViolations } from "../scripts/architecture/find_service_graph_violations.ts"
import { findAuthorityViolations } from "../scripts/architecture/find_authority_violations.ts"
import { loadWorkspace } from "../scripts/architecture/load_workspace.ts"

function service(
  key: string,
  provides: string[],
  consumes: ConsumedContract[] = [],
): LoadedService {
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic architecture boundary regression fixture.",
      kind: "core_capability",
      lifecycle_status: "active",
      functions: [`${key}-v1`],
      contracts: { provides, consumes },
      database: { read: [], write: [] },
      network: { outbound_hosts: [] },
      secrets: [],
      runtime_dependencies: [],
      approved_packages: [],
    },
  }
}

test("rejects cross-service implementation imports", () => {
  const provider = service("provider-service", ["provider.contract.v1"])
  const consumer = service("consumer-service", [], [{
    service: "provider-service",
    contract: "provider.contract.v1",
  }])
  const violations = findImportBoundaryViolations([{
    path: join(consumer.directory, "src", "consumer.ts"),
    service_key: "consumer-service",
    source: "",
    imports: ["../../provider-service/src/private.ts"],
  }], [provider, consumer])

  assert.match(violations.join("\n"), /imports provider-service implementation/)
})

test("allows a declared provider-owned public contract import", () => {
  const provider = service("provider-service", ["provider.contract.v1"])
  const consumer = service("consumer-service", [], [{
    service: "provider-service",
    contract: "provider.contract.v1",
  }])
  const violations = findImportBoundaryViolations([{
    path: join(consumer.directory, "src", "consumer.ts"),
    service_key: "consumer-service",
    source: "",
    imports: ["../../provider-service/contracts/public/provider.contract.v1/schema.ts"],
  }], [provider, consumer])

  assert.deepEqual(violations, [])
})

test("rejects contract cycles", () => {
  const alpha = service("alpha-service", ["alpha.contract.v1"], [{
    service: "beta-service", contract: "beta.contract.v1",
  }])
  const beta = service("beta-service", ["beta.contract.v1"], [{
    service: "alpha-service", contract: "alpha.contract.v1",
  }])

  assert.match(findServiceGraphViolations([alpha, beta]).join("\n"), /cycle/)
})

test("rejects outbound HTTP without declared authority", async () => {
  const workspace = await loadWorkspace()
  const ingest = service("ingest-service", [])
  const violations = findAuthorityViolations(workspace, [ingest], [{
    path: join(ingest.directory, "src", "send.ts"),
    service_key: "ingest-service",
    source: "await fetch('https://example.com')",
    imports: [],
  }])

  assert.match(violations.join("\n"), /outbound HTTP is not declared/)
})
