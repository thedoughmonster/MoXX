import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

import { workspaceRoot } from "../scripts/architecture/paths.ts"
import { assertReleaseHead } from "../scripts/release/assert_release_head.ts"
import type { CommandOptions, CommandResult } from "../scripts/release/types.ts"

test("release rejects dev drift hidden by a narrowed fetch", async () => {
  const fixtureRoot = join(workspaceRoot, ".momi")
  await mkdir(fixtureRoot, { recursive: true })
  const root = await mkdtemp(join(fixtureRoot, "release-base-"))
  const remote = join(root, "remote.git")
  const seed = join(root, "seed")
  const release = join(root, "release")
  const git = (cwd: string, args: string[]): string => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }

  try {
    git(root, ["init", "--bare", remote])
    git(root, ["init", "-b", "dev", seed])
    git(seed, ["config", "user.email", "release-test@example.invalid"])
    git(seed, ["config", "user.name", "Release Test"])
    await writeFile(join(seed, "state.txt"), "initial\n")
    git(seed, ["add", "state.txt"])
    git(seed, ["commit", "-m", "initial"])
    git(seed, ["remote", "add", "origin", remote])
    git(seed, ["push", "origin", "dev", "dev:prod"])
    git(root, ["clone", "--branch", "dev", remote, release])
    git(release, ["config", "--unset-all", "remote.origin.fetch"])
    git(release, ["config", "--add", "remote.origin.fetch",
      "+refs/heads/prod:refs/remotes/origin/prod"])
    const stale = git(release, ["rev-parse", "HEAD"])
    await writeFile(join(seed, "state.txt"), "fresh\n")
    git(seed, ["commit", "-am", "fresh"])
    git(seed, ["push", "origin", "dev"])
    const fresh = git(seed, ["rev-parse", "HEAD"])

    git(release, ["fetch", "origin", "dev"])
    assert.equal(git(release, ["rev-parse", "FETCH_HEAD"]), fresh)
    assert.equal(git(release, ["rev-parse", "origin/dev"]), stale)
    const runner = (
      command: string,
      args: string[],
      options: CommandOptions = {},
    ): CommandResult => {
      const result = spawnSync(command, args, { cwd: release, encoding: "utf8" })
      const stdout = options.capture ? String(result.stdout ?? "") : ""
      const stderr = options.capture ? String(result.stderr ?? "") : ""
      assert.equal(result.status, 0, String(result.stderr ?? ""))
      return { status: result.status ?? 1, stdout, stderr }
    }
    assert.throws(
      () => assertReleaseHead("dev", runner),
      /Local dev must exactly match origin\/dev/,
    )
    assert.equal(git(release, ["rev-parse", "origin/dev"]), fresh)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
