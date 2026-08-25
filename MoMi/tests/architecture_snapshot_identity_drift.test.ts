import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { assertArchitectureSnapshotIdentity } from
  "../scripts/architecture/assert_architecture_snapshot_identity.ts"
import { buildArchitectureSnapshotIdentity } from
  "../scripts/architecture/build_architecture_snapshot_identity.ts"
import {
  ArchitectureSnapshotSourceError,
  type ArchitectureSnapshot,
} from "../scripts/architecture/architecture_snapshot_identity_types.ts"
import { createArchitectureSnapshotRepository } from
  "./create_architecture_snapshot_repository.ts"

test("reports workspace and manifest-schema drift in sorted diagnostics", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, "workspace.json"), JSON.stringify({
    environments: { dev: { branch: "wrong" } },
  }))
  await writeFile(join(root, "schemas", "service-manifest-v1.schema.json"),
    JSON.stringify({
      $id: "https://momi.local/schemas/service-manifest-v2.schema.json",
      properties: { schema_version: { const: 2 } },
    }))
  await writeFile(join(root, "schemas", "function-manifest-v1.schema.json"),
    JSON.stringify({
      $id: "https://momi.local/schemas/function-manifest-v2.schema.json",
    }))
  await assert.rejects(buildArchitectureSnapshotIdentity(root), (error) => {
    assert(error instanceof ArchitectureSnapshotSourceError)
    const paths = error.diagnostics.map((item) => item.field_path)
    assert.deepEqual(paths, [...paths].sort())
    assert(paths.includes("/branch"))
    assert(paths.includes("/service_manifest_schema/id"))
    assert(paths.includes("/service_manifest_schema/version"))
    assert(paths.includes("/function_manifest_schema/id"))
    assert(paths.includes("/function_manifest_schema/version"))
    return true
  })
})

test("assertion names architecture-version and digest mismatch fields", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  const snapshot = await buildArchitectureSnapshotIdentity(root)
  const stale = structuredClone(snapshot) as unknown as {
    identity: Record<string, unknown>
    digest: string
  }
  stale.identity.architecture_contract_version = 1
  stale.digest = "0".repeat(64)
  await assert.rejects(
    assertArchitectureSnapshotIdentity(stale as unknown as ArchitectureSnapshot,
      root),
    (error) => error instanceof Error &&
      error.message.includes("/architecture_contract_version") &&
      error.message.includes("/digest") &&
      error.message.includes("schema_invalid"),
  )
})

test("producer diagnostics survive assertion without raw builder errors", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  const snapshot = await buildArchitectureSnapshotIdentity(root)
  assert.equal(spawnSync("git", ["branch", "-m", "wrong"], { cwd: root }).status, 0)
  await assert.rejects(assertArchitectureSnapshotIdentity(snapshot, root),
    (error) => error instanceof Error &&
      error.message.includes("branch_mismatch") &&
      error.message.includes("/checkout/branch"))
})
