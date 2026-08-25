import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"

const serviceSchema = JSON.parse(await readFile(
  join(workspaceRoot, "schemas", "service-manifest-v1.schema.json"),
  "utf8",
))
const baselineSchema = JSON.parse(await readFile(
  join(workspaceRoot, "schemas", "service-constitution-debt-baseline-v1.schema.json"),
  "utf8",
))
const manifest = {
  schema_version: 1,
  service_key: "fixture-owner",
  purpose: "Synthetic constitution schema validation fixture.",
  kind: "core_capability",
  service_type: "dataset_owner",
  lifecycle_status: "active",
  functions: ["fixture-owner-v1"],
  contracts: { provides: ["fixture.records.read.v1"], consumes: [] },
  database: { read: [], write: [] },
  network: { outbound_hosts: [] },
  secrets: [],
  runtime_dependencies: [],
  approved_packages: [],
  owned_dataset: {
    dataset_key: "fixture.records",
    dataset_class: "domain",
    private_schema: "fixture_records",
    private_relations: ["fixture_records.items"],
    public_reads: ["fixture.records.read.v1"],
    public_commands: ["fixture.records.write.v1"],
    emitted_events: [],
    db_role: "svc_fixture_owner",
  },
}

test("requires owned_dataset to be singular", () => {
  assert.throws(() => validateJson(
    serviceSchema,
    { ...manifest, owned_dataset: [manifest.owned_dataset, manifest.owned_dataset] },
    "fixture",
  ))
})

test("requires fully qualified private relations", () => {
  const owned_dataset = { ...manifest.owned_dataset, private_relations: ["items"] }
  assert.throws(() => validateJson(serviceSchema, { ...manifest, owned_dataset }, "fixture"))
})

test("requires versioned public reads and commands", () => {
  for (const field of ["public_reads", "public_commands"] as const) {
    const owned_dataset = { ...manifest.owned_dataset, [field]: ["fixture.records"] }
    assert.throws(() => validateJson(serviceSchema, { ...manifest, owned_dataset }, "fixture"))
  }
})

test("requires exact public relation read artifacts", () => {
  for (const artifact of [
    { contract: "fixture.records", relation: "fixture_records.items" },
    { contract: "fixture.records.read.v1", relation: "items" },
  ]) {
    const owned_dataset = { ...manifest.owned_dataset,
      public_relation_reads: [artifact] }
    assert.throws(() => validateJson(
      serviceSchema, { ...manifest, owned_dataset }, "fixture",
    ))
  }
})

test("requires exact dotted event keys", () => {
  for (const event of ["*", "warehouse.%", "not dotted"]) {
    const owned_dataset = { ...manifest.owned_dataset, emitted_events: [event] }
    assert.throws(() => validateJson(serviceSchema, { ...manifest, owned_dataset }, "fixture"))
  }
})

test("rejects malformed baseline findings", () => {
  const malformed = {
    $schema: "https://momi.local/schemas/service-constitution-debt-baseline-v1.schema.json",
    schema_version: 1,
    generated_from: "dev@8c6eb4f",
    notes: ["Synthetic exact constitution baseline fixture."],
    findings: [{
      rule_version: 1,
      rule_id: "service_type_missing",
      subject: "services/communications-archive/service.json",
      evidence: { service_key: "communications-archive" },
      fingerprint: "sha256:bad",
      summary: "Service manifest does not declare service_type.",
    }],
  }
  assert.throws(() => validateJson(baselineSchema, malformed, "baseline"))
})

test("rejects a complete non-bootstrap baseline finding", () => {
  const nonBootstrap = {
    $schema: "https://momi.local/schemas/service-constitution-debt-baseline-v1.schema.json",
    schema_version: 1,
    generated_from: "dev@8c6eb4f",
    notes: ["Synthetic exact constitution baseline fixture."],
    findings: [{
      rule_version: 1,
      rule_id: "service_type_missing",
      subject: "services/new-service/service.json",
      evidence: { service_key: "new-service" },
      fingerprint: `sha256:${"0".repeat(64)}`,
      summary: "Service manifest does not declare service_type.",
    }],
  }
  assert.throws(
    () => validateJson(baselineSchema, nonBootstrap, "baseline"),
    /must be equal to one of the allowed values/,
  )
})
