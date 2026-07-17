import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import type {
  LoadedService,
  ServiceManifest,
} from "../scripts/architecture/types.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"
import type { ServiceType } from
  "../scripts/architecture/service_manifest_types.ts"
import { findServiceConstitutionFindings } from
  "../scripts/constitution/find_service_constitution_findings.ts"

function specializedService(
  key: string,
  type: ServiceType,
  datasetKey: string,
): LoadedService {
  const stem = key.replaceAll("-", "_")
  const contract = `${stem}.operations.read.v1`
  return {
    directory: join(workspaceRoot, "services", key),
    manifest: {
      schema_version: 1,
      service_key: key,
      purpose: "Synthetic specialized operational dataset fixture.",
      kind: type === "destination_adapter"
        ? "destination_adapter"
        : "core_capability",
      service_type: type,
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
        private_schema: stem,
        private_relations: [`${stem}.operations`],
        public_reads: [contract],
        public_commands: [],
        emitted_events: [`${stem}.operations.changed`],
        db_role: `svc_${stem}`,
      },
    },
  }
}

test("specialized services may each own one operational dataset", () => {
  for (const type of ["event_router", "destination_adapter"] as const) {
    const owner = specializedService(
      `${type.replaceAll("_", "-")}-owner`,
      type,
      `fixture.${type}.operations`,
    )
    assert.deepEqual(findServiceConstitutionFindings([owner]), [], type)
  }
})

test("specialized services cannot share one dataset ownership key", () => {
  const router = specializedService("router-owner", "event_router", "fixture.shared")
  const destination = specializedService(
    "destination-owner",
    "destination_adapter",
    "fixture.shared",
  )
  const rules = findServiceConstitutionFindings([router, destination])
    .map((finding) => finding.rule_id)
  assert.deepEqual(rules, ["dataset_key_duplicate"])
})

test("a specialized service cannot declare multiple owned datasets", async () => {
  const schema = JSON.parse(await readFile(
    join(workspaceRoot, "schemas", "service-manifest-v1.schema.json"),
    "utf8",
  ))
  const owner = specializedService("router-owner", "event_router", "fixture.router")
  const manifest = owner.manifest as ServiceManifest
  assert.throws(() => validateJson(schema, {
    ...manifest,
    owned_dataset: [manifest.owned_dataset, manifest.owned_dataset],
  }, "fixture"))
})
