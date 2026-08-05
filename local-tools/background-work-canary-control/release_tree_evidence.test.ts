import assert from "node:assert/strict"
import { test } from "node:test"

import { collectReleaseTreeSha } from "./collect_release_tree_sha.ts"
import type { BoundedChildRunner } from "./runtime_adapter_types.ts"

test("release tree evidence uses one exact sanitized local Git read", async () => {
  const tree = "a".repeat(40)
  let calls = 0
  const runner: BoundedChildRunner = async (request) => {
    calls += 1
    assert.deepEqual(request.arguments, ["-C", "/trusted/repository", "rev-parse",
      `${"b".repeat(40)}^{tree}`])
    assert.equal(request.environment?.SUPABASE_ACCESS_TOKEN, undefined)
    const stdout = new TextEncoder().encode(`${tree}\n`)
    return { outcome: { status: "success", exitCode: 0, signal: null,
      stdoutBytes: stdout.byteLength, stderrBytes: 0, limitedStream: null },
      stdout, stderr: new Uint8Array() }
  }
  assert.equal(await collectReleaseTreeSha("/trusted/repository", "b".repeat(40), {
    gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
    flockExecutable: "/trusted/flock",
  }, runner, { PATH: "/trusted", SUPABASE_ACCESS_TOKEN: "private" }), tree)
  assert.equal(calls, 1)
})

test("release tree evidence rejects malformed, noisy, or failed reads", async () => {
  for (const fault of ["malformed", "stderr", "failed"] as const) {
    const runner: BoundedChildRunner = async () => {
      const stdout = new TextEncoder().encode(fault === "malformed" ? "not-a-tree\n" :
        `${"a".repeat(40)}\n`)
      const stderr = fault === "stderr" ? new TextEncoder().encode("private") : new Uint8Array()
      return { outcome: { status: fault === "failed" ? "exit_failure" : "success",
        exitCode: fault === "failed" ? 1 : 0, signal: null, stdoutBytes: stdout.byteLength,
        stderrBytes: stderr.byteLength, limitedStream: null }, stdout, stderr }
    }
    await assert.rejects(collectReleaseTreeSha("/trusted/repository", "b".repeat(40), {
      gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
      flockExecutable: "/trusted/flock",
    }, runner, {}), undefined, fault)
  }
  await assert.rejects(collectReleaseTreeSha("/trusted/repository", "invalid", {
    gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
    flockExecutable: "/trusted/flock",
  }, async () => { throw new Error("must not run") }, {}))
})
