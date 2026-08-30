import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { workspaceRoot } from "../scripts/architecture/paths.ts"

export async function createArchitectureSnapshotRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "momi-snapshot-"))
  await mkdir(join(root, "schemas"))
  await writeFile(join(root, "workspace.json"), JSON.stringify({
    environments: { dev: { branch: "dev" } },
  }))
  await writeFile(join(root, "schemas", "service-manifest-v1.schema.json"),
    JSON.stringify({
      $id: "https://momi.local/schemas/service-manifest-v1.schema.json",
      properties: { schema_version: { const: 1 } },
    }))
  await writeFile(join(root, "schemas", "function-manifest-v1.schema.json"),
    JSON.stringify({
      $id: "https://momi.local/schemas/function-manifest-v1.schema.json",
    }))
  const identitySchema = await readFile(
    join(workspaceRoot, "schemas", "architecture-snapshot-identity-v2.schema.json"),
  )
  await writeFile(
    join(root, "schemas", "architecture-snapshot-identity-v2.schema.json"),
    identitySchema,
  )
  assert.equal(spawnSync("git", ["init", "-b", "dev"], { cwd: root }).status, 0)
  assert.equal(spawnSync("git", [
    "config", "user.email", "snapshot@example.invalid",
  ], { cwd: root }).status, 0)
  assert.equal(spawnSync("git", [
    "config", "user.name", "Snapshot Test",
  ], { cwd: root }).status, 0)
  assert.equal(spawnSync("git", ["remote", "add", "origin",
    "https://github.com/thedoughmonster/MoXX.git"],
  { cwd: root }).status, 0)
  assert.equal(spawnSync("git", ["add", "."], { cwd: root }).status, 0)
  assert.equal(spawnSync("git", ["commit", "-m", "fixture"],
    { cwd: root }).status, 0)
  assert.equal(spawnSync("git", [
    "update-ref", "refs/remotes/origin/dev", "HEAD",
  ], { cwd: root }).status, 0)
  return root
}
