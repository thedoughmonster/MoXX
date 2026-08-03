import assert from "node:assert/strict"
import { test } from "node:test"

import { createFakeHeldProvider } from "./create_fake_held_provider.test_fixture.ts"
import { prepareReleasedRuntime } from "./prepare_released_runtime.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type { RuntimePreparationDependencies } from "./runtime_adapter_types.ts"

const repository = {
  nodeVersion: "24.14.0" as const,
  pnpmVersion: "11.7.0" as const,
  supabaseCliVersion: "2.109.1" as const,
  branch: "dev" as const,
  headSha: "9e9425ac63cdfaf2fad0fb8a12b975642221aac9",
  projectRef: "xtbraqnlskmqxinjxxdn" as const,
}

test("released runtime consumes exact setup evidence before provider preparation", async () => {
  let released = false
  let claimed = false
  let providerCreated = false
  const provider = createFakeHeldProvider()
  const root = process.cwd()
  const dependencies: RuntimePreparationDependencies = {
    environment: {}, nodeVersion: "24.14.0",
    runChild: async () => { throw new Error("not called directly") },
    resolveExecutables: async () => ({
      gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
      flockExecutable: "/usr/bin/flock",
    }),
    testFlock: async () => ({ executablePath: "/usr/bin/flock",
      identitySha256: "a".repeat(64), conflictRefused: true, reacquired: true }),
    acquireLock: async () => ({ flockPath: "/usr/bin/flock", lockPath: "/tmp/lock",
      holderPid: 999_999, lossSignal: new AbortController().signal,
      status: () => released ? "released" as const : "held" as const,
      release: async () => { released = true } }),
    collectEvidence: async () => repository,
    validateLinkage: async () => ({ identitySha256: "b".repeat(64), ipv4Resolved: true }),
    prepareReceiptRoot: async () => "/trusted/receipts",
    claimReceipt: async (_receiptRoot, binding) => {
      claimed = true
      assert.equal(providerCreated, false)
      assert.equal(binding.releaseSha, repository.headSha)
      return {} as never
    },
    nowMs: () => 1_000,
    createProvider: async () => { providerCreated = true; return provider },
  }
  const runtime = await prepareReleasedRuntime([
    "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
  ], root, dependencies)
  assert.equal(claimed, true)
  assert.equal(providerCreated, true)
  assert.equal(runtime.provider, provider)
  await runtime.lock.release()
  assert.equal(released, true)
})

test("every linkage, flock, and receipt failure fences provider preparation", async () => {
  for (const failure of [
    "flock", "LinkageMetadataUnsafe", "LinkageProjectMismatch",
    "LinkageUrlInvalid", "LinkageDnsFailed", "receipt",
  ] as const) {
    let lockAcquired = false
    let released = false
    let providerCreated = false
    const dependencies = {
      environment: {}, nodeVersion: "24.14.0",
      runChild: async () => { throw new Error("unused") },
      resolveExecutables: async () => ({ gitExecutable: "/trusted/git",
        pnpmExecutable: "/trusted/pnpm", flockExecutable: "/usr/bin/flock" }),
      testFlock: async () => {
        if (failure === "flock") throw new SetupPreflightError("FlockUnavailable", "flock")
        return { executablePath: "/usr/bin/flock" as const,
          identitySha256: "a".repeat(64), conflictRefused: true as const,
          reacquired: true as const }
      },
      acquireLock: async () => { lockAcquired = true; return {
        flockPath: "/usr/bin/flock", lockPath: "/tmp/lock", holderPid: 1,
        lossSignal: new AbortController().signal,
        status: () => released ? "released" as const : "held" as const,
        release: async () => { released = true },
      } },
      collectEvidence: async () => repository,
      validateLinkage: async () => {
        if (failure !== "flock" && failure !== "receipt") {
          throw new SetupPreflightError(failure, "linkage")
        }
        return { identitySha256: "b".repeat(64), ipv4Resolved: true as const }
      },
      prepareReceiptRoot: async () => "/trusted/receipts",
      claimReceipt: async () => {
        if (failure === "receipt") {
          throw new SetupPreflightError("ReceiptMismatch", "receipt")
        }
        return {} as never
      },
      nowMs: () => 1_000,
      createProvider: async () => { providerCreated = true; return createFakeHeldProvider() },
    } satisfies RuntimePreparationDependencies
    await assert.rejects(prepareReleasedRuntime([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), dependencies))
    assert.equal(providerCreated, false, failure)
    assert.equal(lockAcquired, failure !== "flock", failure)
    assert.equal(released, failure !== "flock", failure)
  }
})
