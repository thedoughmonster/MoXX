import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { assertArchitectureSnapshotIdentity } from
  "../scripts/architecture/assert_architecture_snapshot_identity.ts"
import { buildArchitectureSnapshotIdentity } from
  "../scripts/architecture/build_architecture_snapshot_identity.ts"
import { createArchitectureSnapshotRepository } from
  "./create_architecture_snapshot_repository.ts"

test("builds and asserts an exact clean committed snapshot", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  const first = await buildArchitectureSnapshotIdentity(root)
  const second = await buildArchitectureSnapshotIdentity(root)
  assert.deepEqual(first, second)
  await assertArchitectureSnapshotIdentity(first, root)
  await assert.rejects(
    assertArchitectureSnapshotIdentity({ ...first, digest: "0".repeat(64) }, root),
    /source_snapshot mismatch/,
  )
  await assert.rejects(
    assertArchitectureSnapshotIdentity({ ...first, extra: true }, root),
    /schema_invalid/,
  )
})

test("rejects staged, unstaged, and untracked checkout state", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  const workspace = join(root, "workspace.json")
  await writeFile(workspace, `${await readFile(workspace, "utf8")} `)
  await assert.rejects(buildArchitectureSnapshotIdentity(root), /source is invalid/)
  assert.equal(spawnSync("git", ["checkout", "--", "workspace.json"],
    { cwd: root }).status, 0)
  await writeFile(join(root, "untracked.txt"), "untracked")
  await assert.rejects(buildArchitectureSnapshotIdentity(root), /source is invalid/)
  await rm(join(root, "untracked.txt"))
  await writeFile(workspace, `${await readFile(workspace, "utf8")} `)
  assert.equal(spawnSync("git", ["add", "workspace.json"],
    { cwd: root }).status, 0)
  await assert.rejects(buildArchitectureSnapshotIdentity(root), /source is invalid/)
})

test("rejects wrong repository and current branch", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  assert.equal(spawnSync("git", ["remote", "set-url", "origin",
    "https://github.com/example/other.git"], { cwd: root }).status, 0)
  await assert.rejects(buildArchitectureSnapshotIdentity(root),
    (error: unknown) => JSON.stringify(error).includes("repository") ||
      (error instanceof Error && error.message.includes("source is invalid")))
  assert.equal(spawnSync("git", ["remote", "set-url", "origin",
    "https://github.com/thedoughmonster/MoXX.git"],
  { cwd: root }).status, 0)
  assert.equal(spawnSync("git", ["branch", "-m", "wrong"], { cwd: root }).status, 0)
  await assert.rejects(buildArchitectureSnapshotIdentity(root),
    (error: unknown) => error instanceof Error &&
      error.message.includes("source is invalid"))
})

test("rejects missing and non-ancestor authoritative refs", async (t) => {
  const root = await createArchitectureSnapshotRepository()
  t.after(() => rm(root, { recursive: true, force: true }))
  assert.equal(spawnSync("git", [
    "update-ref", "-d", "refs/remotes/origin/dev",
  ], { cwd: root }).status, 0)
  await assert.rejects(buildArchitectureSnapshotIdentity(root), /source is invalid/)
  assert.equal(spawnSync("git", [
    "update-ref", "refs/remotes/origin/dev", "HEAD",
  ], { cwd: root }).status, 0)
  const unrelated = spawnSync("git", [
    "commit-tree", "HEAD^{tree}", "-m", "unrelated",
  ], { cwd: root, encoding: "utf8" })
  assert.equal(unrelated.status, 0)
  assert.equal(spawnSync("git", [
    "update-ref", "refs/remotes/origin/dev", unrelated.stdout.trim(),
  ], { cwd: root }).status, 0)
  await assert.rejects(buildArchitectureSnapshotIdentity(root), /source is invalid/)
})
