import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"

const schema = JSON.parse(await readFile(
  join(workspaceRoot, "schemas", "service-manifest-v1.schema.json"),
  "utf8",
))
const manifest = {
  schema_version: 1,
  service_key: "fixture-registry",
  purpose: "Own one database-only operational registry.",
  kind: "core_capability",
  service_type: "dataset_owner",
  lifecycle_status: "active",
  functions: [],
  contracts: { provides: [], consumes: [] },
  database: { read: [], write: [] },
  network: { outbound_hosts: [] },
  secrets: [],
  configuration: ["MOMI_REGISTRY_MODE"],
  deployment: {
    owns: [{ kind: "database_processor", key: "momi_runtime.resolve_v1" }],
    depends_on: [{ kind: "postgres_extension", key: "pg_cron" }],
  },
  runtime_dependencies: [],
  approved_packages: [],
  owned_dataset: {
    dataset_key: "momi.runtime_registry",
    dataset_class: "operational",
    private_relations: ["momi_runtime.function_registry"],
  },
}

test("accepts a typed database-only service", () => {
  assert.doesNotThrow(() => validateJson(schema, manifest, "fixture"))
})

test("rejects malformed operational unit keys", () => {
  const deployment = {
    ...manifest.deployment,
    owns: [{ kind: "database_processor", key: "Not Qualified" }],
  }
  assert.throws(() => validateJson(schema, { ...manifest, deployment }, "fixture"))
})
