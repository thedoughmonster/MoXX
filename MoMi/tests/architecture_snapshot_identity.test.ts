import assert from "node:assert/strict"
import test from "node:test"

import { architectureSnapshotIdentitySchemaPath } from
  "../scripts/architecture/paths.ts"
import {
  architectureSnapshotIdentitySchemaId,
  type ArchitectureSnapshot,
  type ArchitectureSnapshotIdentity,
} from "../scripts/architecture/architecture_snapshot_identity_types.ts"
import { digestArchitectureSnapshotIdentity } from
  "../scripts/architecture/digest_architecture_snapshot_identity.ts"
import { findArchitectureSnapshotIdentityDiagnostics } from
  "../scripts/architecture/find_architecture_snapshot_identity_diagnostics.ts"
import { readJson } from "../scripts/architecture/read_json.ts"
import { validateJson } from "../scripts/architecture/validate_json.ts"

const identity: ArchitectureSnapshotIdentity = {
  $schema: architectureSnapshotIdentitySchemaId,
  architecture_contract_version: 2,
  branch: "dev",
  commit: "199b290990aea2731542a08bb91757ca83a72eb3",
  function_manifest_schema: {
    id: "https://momi.local/schemas/function-manifest-v1.schema.json",
    version: 1,
  },
  repository: "thedoughmonster/momi-backend",
  schema_version: 1,
  service_manifest_schema: {
    id: "https://momi.local/schemas/service-manifest-v1.schema.json",
    version: 1,
  },
}

test("validates and digests the accepted current-dev identity", async () => {
  const schema = await readJson<object>(architectureSnapshotIdentitySchemaPath)
  assert.doesNotThrow(() => validateJson(schema, identity, "identity"))
  assert.equal(
    digestArchitectureSnapshotIdentity(identity),
    "fe73901c2fd9af22383185da9a47ff820c3af358fcc266effac3aa6f9902da21",
  )
  const reordered = Object.fromEntries(
    Object.entries(identity).reverse(),
  ) as unknown as ArchitectureSnapshotIdentity
  assert.equal(
    digestArchitectureSnapshotIdentity(reordered),
    digestArchitectureSnapshotIdentity(identity),
  )
  assert.notEqual(
    digestArchitectureSnapshotIdentity({
      ...identity, commit: "0000000000000000000000000000000000000000",
    }),
    digestArchitectureSnapshotIdentity(identity),
  )
})

test("rejects incomplete, abbreviated, uppercase, and unknown identities", async () => {
  const schema = await readJson<object>(architectureSnapshotIdentitySchemaPath)
  const invalid = [
    { ...identity, commit: undefined },
    { ...identity, commit: identity.commit.slice(0, 12) },
    { ...identity, commit: identity.commit.toUpperCase() },
    { ...identity, unexpected: true },
    { ...identity, schema_version: 2 },
  ]
  for (const candidate of invalid) {
    assert.throws(() => validateJson(schema, candidate, "identity"))
  }
})

test("reports deterministic field and digest mismatches", () => {
  const expected: ArchitectureSnapshot = {
    identity,
    digest: digestArchitectureSnapshotIdentity(identity),
  }
  const actualIdentity = {
    ...identity,
    commit: "0000000000000000000000000000000000000000",
  }
  const actual: ArchitectureSnapshot = {
    identity: actualIdentity,
    digest: digestArchitectureSnapshotIdentity(actualIdentity),
  }
  const first = findArchitectureSnapshotIdentityDiagnostics(expected, actual)
  const second = findArchitectureSnapshotIdentityDiagnostics(expected, actual)
  assert.deepEqual(first, second)
  assert(first.some((item) => item.field_path === "/commit"))
  assert(first.some((item) => item.field_path === "/digest"))
})
