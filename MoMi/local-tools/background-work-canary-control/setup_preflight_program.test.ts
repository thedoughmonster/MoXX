import assert from "node:assert/strict"
import { test } from "node:test"

import type { BoundedChildResult } from "./process_types.ts"
import { runSetupPreflight } from "./run_setup_preflight.ts"
import type { SetupProgramDependencies } from "./setup_program_types.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"

const repository = {
  nodeVersion: "24.14.0" as const, pnpmVersion: "11.7.0" as const,
  supabaseCliVersion: "2.109.1" as const, branch: "dev" as const,
  headSha: "a".repeat(40), projectRef: "xtbraqnlskmqxinjxxdn" as const,
}
const success: BoundedChildResult = {
  outcome: { status: "success", exitCode: 0, signal: null,
    stdoutBytes: 0, stderrBytes: 0, limitedStream: null },
  stdout: new Uint8Array(), stderr: new Uint8Array(),
}

function fakeSetupDependencies(overrides: Partial<SetupProgramDependencies> = {}) {
  let now = Date.parse("2026-08-02T18:00:00.000Z")
  const calls: string[] = []
  const dependencies: SetupProgramDependencies = {
    environment: {}, nodeVersion: "24.14.0", nowMs: () => now++,
    prepareReceiptRoot: async () => { calls.push("receipt-root"); return "/receipts" },
    assertReceiptAvailable: async () => { calls.push("receipt-available") },
    resolveExecutables: async () => { calls.push("executables"); return {
      gitExecutable: "/git", pnpmExecutable: "/pnpm", flockExecutable: "/usr/bin/flock",
    } },
    collectRepository: async () => { calls.push("repository"); return repository },
    testFlock: async () => { calls.push("flock"); return {
      executablePath: "/usr/bin/flock", identitySha256: "b".repeat(64),
      conflictRefused: true, reacquired: true,
    } },
    linkProject: async () => { calls.push("link"); return success },
    validateLinkage: async () => { calls.push("linkage"); return {
      identitySha256: "c".repeat(64), ipv4Resolved: true,
    } },
    writeReceipt: async (_root, core) => { calls.push("write"); return {
      ...core, receiptPath: "/receipts/setup/setup-fake.json",
      integritySha256: "d".repeat(64), receiptSha256: "e".repeat(64),
    } },
    writeFailure: async (_root, core) => { calls.push("failure-write"); return {
      ...core, receiptPath: "/receipts/setup/setup-failure.json",
      integritySha256: "d".repeat(64), receiptSha256: "e".repeat(64),
    } },
    ...overrides,
  }
  return { dependencies, calls }
}

test("runs one authorized setup path with fakes and emits only sanitized evidence", async () => {
  const { dependencies, calls } = fakeSetupDependencies()
  const result = await runSetupPreflight([
    "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
  ], process.cwd(), dependencies)
  assert.equal(result.exitCode, 0)
  assert.deepEqual(calls, [
    "receipt-root", "receipt-available", "executables", "repository", "flock", "link",
    "linkage", "write",
  ])
  const terminal = JSON.stringify(result)
  for (const forbidden of ["postgresql://", "pooler.supabase.com", "192.0.2.1",
    "credential", "select *", "provider-payload", "stack"]) {
    assert.equal(terminal.includes(forbidden), false, forbidden)
  }
})

test("one setup blocker stops before every later stage", async () => {
  for (const failure of ["receipt", "repository", "flock", "link", "linkage"] as const) {
    const overrides: Partial<SetupProgramDependencies> = failure === "receipt"
      ? { assertReceiptAvailable: async () => { throw new SetupPreflightError(
          "ReceiptReused", "receipt") } }
      : failure === "repository"
      ? { collectRepository: async () => { throw new Error("repository") } }
      : failure === "flock"
        ? { testFlock: async () => { throw new SetupPreflightError(
            "FlockUnavailable", "flock") } }
        : failure === "link"
          ? { linkProject: async () => ({ ...success,
              outcome: { ...success.outcome, status: "exit_failure", exitCode: 7 } }) }
          : { validateLinkage: async () => { throw new SetupPreflightError(
              "LinkageDnsFailed", "linkage") } }
    const { dependencies, calls } = fakeSetupDependencies(overrides)
    const result = await runSetupPreflight([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), dependencies)
    assert.equal(result.exitCode, 20, failure)
    assert.equal(calls.includes("write"), false, failure)
    assert.equal(calls.includes("failure-write"), true, failure)
    if (failure === "receipt") assert.equal(calls.includes("executables"), false, failure)
    if (failure !== "linkage") assert.equal(calls.includes("linkage"), false, failure)
  }
})
