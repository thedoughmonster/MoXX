import assert from "node:assert/strict"
import { test } from "node:test"
import { prepareReleasedRuntime } from "./prepare_released_runtime.ts"

const repository = {
  nodeVersion: "24.14.0" as const,
  pnpmVersion: "11.7.0" as const,
  supabaseCliVersion: "2.109.1" as const,
  branch: "dev" as const,
  headSha: "9e9425ac63cdfaf2fad0fb8a12b975642221aac9",
  projectRef: "xtbraqnlskmqxinjxxdn" as const,
}

test("released runtime wiring holds one accepted lifecycle lock", async () => {
  let released = false
  const runtime = await prepareReleasedRuntime([
    "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
  ], "/trusted/repository", {
    environment: { PATH: "/trusted/bin" }, nodeVersion: "24.14.0",
    runChild: async () => { throw new Error("not called directly") },
    resolveExecutables: async () => ({
      gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
      flockExecutable: "/trusted/flock",
    }),
    acquireLock: async () => ({
      flockPath: "/trusted/flock", lockPath: "/tmp/momi-330-canary-control.lock",
      holderPid: 999_999, lossSignal: new AbortController().signal,
      status: () => released ? "released" as const : "held" as const,
      release: async () => { released = true },
    }),
    collectEvidence: async () => repository,
  })
  assert.equal(released, false)
  assert.equal(runtime.repository.headSha, repository.headSha)
  await runtime.lock.release()
  assert.equal(released, true)
})

test("released runtime wiring releases lock on evidence or executable drift", async () => {
  for (const flockPath of ["/trusted/flock", "/other/flock"]) {
    let released = false
    await assert.rejects(prepareReleasedRuntime([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], "/trusted/repository", {
      environment: {}, nodeVersion: "24.14.0",
      runChild: async () => { throw new Error("unused") },
      resolveExecutables: async () => ({
        gitExecutable: "/trusted/git", pnpmExecutable: "/trusted/pnpm",
        flockExecutable: "/trusted/flock",
      }),
      acquireLock: async () => ({ flockPath, lockPath: "/tmp/lock",
        holderPid: 999_999, lossSignal: new AbortController().signal,
        status: () => released ? "released" as const : "held" as const,
        release: async () => { released = true } }),
      collectEvidence: async () => { throw new Error("preflight failed") },
    }))
    assert.equal(released, true)
  }
})
