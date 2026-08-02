import assert from "node:assert/strict"
import { chmod, lstat, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import test from "node:test"

import { acquireCanaryControlLock } from "./acquire_canary_control_lock.ts"
import { CANARY_LOCK_FILENAME } from "./process_constants.ts"
import { resolveFlockExecutable } from "./resolve_flock_executable.ts"

test("flock resolution and lifecycle lock fail closed and release cleanly", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-canary-lock-test-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  const missing = join(root, "missing")
  await mkdir(missing, { mode: 0o700 })
  await assert.rejects(resolveFlockExecutable({ PATH: missing }), /unavailable or unsafe/)
  await assert.rejects(resolveFlockExecutable({ PATH: `relative${delimiter}${missing}` }), /unsafe/)

  const nonExecutable = join(root, "non-executable")
  await mkdir(nonExecutable, { mode: 0o700 })
  await writeFile(join(nonExecutable, "flock"), "fixture", { mode: 0o600 })
  await assert.rejects(resolveFlockExecutable({ PATH: nonExecutable }), /unsafe/)

  const nonRegular = join(root, "non-regular")
  await mkdir(join(nonRegular, "flock"), { recursive: true, mode: 0o700 })
  await assert.rejects(resolveFlockExecutable({ PATH: nonRegular }), /unsafe/)

  const unsafeLink = join(root, "unsafe-link")
  const unsafeTarget = join(root, "unsafe-flock")
  await mkdir(unsafeLink, { mode: 0o700 })
  await writeFile(unsafeTarget, "fixture", { mode: 0o700 })
  await chmod(unsafeTarget, 0o777)
  await symlink(unsafeTarget, join(unsafeLink, "flock"))
  await assert.rejects(resolveFlockExecutable({ PATH: unsafeLink }), /unsafe/)

  const safeLink = join(root, "safe-link")
  const safeTargetDirectory = join(root, "safe-target")
  const safeTarget = join(safeTargetDirectory, "flock-bin")
  await mkdir(safeLink, { mode: 0o700 })
  await mkdir(safeTargetDirectory, { mode: 0o700 })
  await writeFile(safeTarget, "fixture", { mode: 0o700 })
  await symlink(safeTarget, join(safeLink, "flock"))
  assert.equal(await resolveFlockExecutable({ PATH: safeLink }), safeTarget)

  const runtime = join(root, "runtime")
  await mkdir(runtime, { mode: 0o700 })
  await writeFile(join(runtime, "unrelated"), "preserve")
  const unsafeRuntime = join(root, "unsafe-runtime")
  await mkdir(unsafeRuntime, { mode: 0o777 })
  await chmod(unsafeRuntime, 0o777)
  await assert.rejects(
    acquireCanaryControlLock({ PATH: process.env.PATH, XDG_RUNTIME_DIR: unsafeRuntime }),
    /unavailable or unsafe/,
  )
  const source = { PATH: process.env.PATH, XDG_RUNTIME_DIR: runtime }
  const first = await acquireCanaryControlLock(source)
  assert.equal(first.lockPath, join(runtime, CANARY_LOCK_FILENAME))
  assert.ok(first.flockPath.startsWith("/"))
  assert.equal((await lstat(first.lockPath)).mode & 0o777, 0o600)
  await assert.rejects(acquireCanaryControlLock(source), /already held/)
  const releasing = first.release()
  assert.equal(first.status(), "releasing")
  await releasing
  await first.release()
  assert.equal(first.status(), "released")
  assert.equal(first.lossSignal.aborted, false)

  const second = await acquireCanaryControlLock(source)
  const lost = new Promise<void>((resolve) =>
    second.lossSignal.addEventListener("abort", () => resolve(), { once: true }))
  process.kill(second.holderPid, "SIGKILL")
  await lost
  assert.equal(second.status(), "lost")
  await assert.rejects(second.release(), /already lost/)
  assert.equal(second.status(), "lost")
  const replacement = await acquireCanaryControlLock(source)
  await replacement.release()
  assert.equal((await lstat(join(runtime, "unrelated"))).isFile(), true)
  assert.equal((await lstat(first.lockPath)).isFile(), true)
  await assert.rejects(
    acquireCanaryControlLock({ PATH: missing, XDG_RUNTIME_DIR: runtime }),
    /unavailable or unsafe/,
  )
})
