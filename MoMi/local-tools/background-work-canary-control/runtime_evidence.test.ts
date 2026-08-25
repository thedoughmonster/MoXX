import assert from "node:assert/strict"
import { mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { collectRuntimeEvidence } from "./collect_runtime_evidence.ts"
import { createRepositoryFixture } from "./repository_fixture.test_fixture.ts"
import type { BoundedChildStatus } from "./process_types.ts"
import type { BoundedChildRunner } from "./runtime_adapter_types.ts"
const HEAD = "9e9425ac63cdfaf2fad0fb8a12b975642221aac9"
const executables = {
  gitExecutable: "/trusted/git",
  pnpmExecutable: "/trusted/pnpm",
  flockExecutable: "/trusted/flock",
}
function fakeEvidenceRunner(root: string, overrides: Record<string, string> = {}): {
  runner: BoundedChildRunner; calls: string[][]
} {
  const childResult = (stdout: string, status: BoundedChildStatus = "success") => {
    const bytes = new TextEncoder().encode(stdout)
    return { outcome: { status, exitCode: status === "success" ? 0 : 1,
      signal: null, stdoutBytes: bytes.byteLength, stderrBytes: 0, limitedStream: null },
    stdout: bytes, stderr: new Uint8Array() }
  }
  const calls: string[][] = []
  const runner: BoundedChildRunner = async (request) => {
    calls.push([request.executable, ...request.arguments])
    assert.equal(request.environment?.SUPABASE_ACCESS_TOKEN, undefined)
    if (request.executable === executables.pnpmExecutable) {
      return childResult(overrides.pnpm ?? "11.7.0\n")
    }
    const operation = request.arguments.slice(2).join(" ")
    assert.deepEqual(request.arguments.slice(0, 2), ["-C", root])
    if (operation === "symbolic-ref --short HEAD") {
      if (overrides.detached) return childResult("", "exit_failure")
      return childResult(overrides.branch ?? "dev\n")
    }
    if (operation === "rev-parse HEAD") return childResult(overrides.head ?? `${HEAD}\n`)
    if (operation === "rev-parse refs/remotes/origin/dev") {
      if (overrides.missingExpected) return childResult("", "exit_failure")
      return childResult(overrides.expected ?? `${HEAD}\n`)
    }
    if (operation === "status --porcelain=v1 --untracked-files=all") {
      return childResult(overrides.status ?? "")
    }
    throw new Error("Unexpected fake evidence command")
  }
  return { runner, calls }
}

test("collector obtains exact evidence with fixed argv and sanitized environment", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-runtime-evidence-"))
  try {
    createRepositoryFixture(root)
    const { runner, calls } = fakeEvidenceRunner(root)
    const result = await collectRuntimeEvidence(root, executables, runner, "24.14.0", {
      PATH: "/trusted", SUPABASE_ACCESS_TOKEN: "private-token",
    })
    assert.equal(result.headSha, HEAD)
    assert.deepEqual(calls.map((call) => call.slice(0, 2)), [
      ["/trusted/pnpm", "--version"], ["/trusted/git", "-C"],
      ["/trusted/git", "-C"], ["/trusted/git", "-C"], ["/trusted/git", "-C"],
    ])
    assert.deepEqual(calls.slice(1).map((call) => call.slice(3)), [
      ["symbolic-ref", "--short", "HEAD"], ["rev-parse", "HEAD"],
      ["rev-parse", "refs/remotes/origin/dev"],
      ["status", "--porcelain=v1", "--untracked-files=all"],
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test("collector rejects dirty, diverged, detached, malformed, and wrong-link evidence", async () => {
  for (const overrides of [
    { status: "?? private.sql\n" }, { expected: `${"b".repeat(40)}\n` },
    { detached: "1" }, { missingExpected: "1" }, { branch: "prod\n" },
    { pnpm: "11.6.0\n" },
  ]) {
    const root = await mkdtemp(join(tmpdir(), "momi-runtime-reject-"))
    try {
      createRepositoryFixture(root)
      const { runner } = fakeEvidenceRunner(root, overrides)
      await assert.rejects(collectRuntimeEvidence(root, executables, runner, "24.14.0",
        {}))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
  const root = await mkdtemp(join(tmpdir(), "momi-runtime-link-"))
  try {
    createRepositoryFixture(root)
    await writeFile(join(root, "supabase/.temp/project-ref"), "viodfldzuoypnpqaagag\n")
    await assert.rejects(collectRuntimeEvidence(
      root, executables, fakeEvidenceRunner(root).runner, "24.14.0",
      {},
    ))
    await assert.rejects(collectRuntimeEvidence(
      root, executables, fakeEvidenceRunner(root).runner, "23.0.0",
      {},
    ))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("collector rejects symlinked repository control files before acceptance", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-runtime-symlink-"))
  const external = await mkdtemp(join(tmpdir(), "momi-runtime-external-"))
  try {
    createRepositoryFixture(root)
    const target = join(external, "package.json")
    await writeFile(target, "{}")
    await unlink(join(root, "package.json"))
    await symlink(target, join(root, "package.json"))
    await assert.rejects(collectRuntimeEvidence(
      root, executables, fakeEvidenceRunner(root).runner, "24.14.0",
      {},
    ))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(external, { recursive: true, force: true })
  }
})
