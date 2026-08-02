import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { acquireCanaryControlLock } from "./acquire_canary_control_lock.ts"
import { LOCK_READY_MARKER,
  LOCK_RELEASED_MARKER } from "./process_constants.ts"

test("real holder requires its exact flushed EOF release acknowledgment", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-lock-release-protocol-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  const cases = [
    ["truncated", [
      `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)},()=>{`,
      "process.stdin.resume();process.stdin.once('end',()=>",
      "process.stdout.write('RELEASE',()=>process.exit(0)));});",
    ].join("")],
    ["extra", [
      `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)},()=>{`,
      "process.stdin.resume();process.stdin.once('end',()=>",
      `process.stdout.write(${JSON.stringify(`${LOCK_RELEASED_MARKER}X`)},`,
      "()=>process.exit(0)));});",
    ].join("")],
    ["nonzero", [
      `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)},()=>{`,
      "process.stdin.resume();process.stdin.once('end',()=>",
      `process.stdout.write(${JSON.stringify(LOCK_RELEASED_MARKER)},`,
      "()=>process.exit(7)));});",
    ].join("")],
    ["signal", [
      `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)},()=>{`,
      "process.stdin.resume();process.stdin.once('end',()=>",
      `process.stdout.write(${JSON.stringify(LOCK_RELEASED_MARKER)},`,
      "()=>process.kill(process.pid,'SIGKILL')));});",
    ].join("")],
    ["timeout", [
      `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)},()=>{`,
      "process.stdin.resume();process.stdin.once('end',()=>",
      "setInterval(()=>{},1000));});",
    ].join("")],
  ] as const
  for (const [name, holderScript] of cases) {
    const runtime = join(root, name)
    await mkdir(runtime, { mode: 0o700 })
    const lock = await acquireCanaryControlLock({
      PATH: process.env.PATH, XDG_RUNTIME_DIR: runtime,
    }, { holderScript, releaseTimeoutMs: 40 })
    await assert.rejects(lock.release(), undefined, name)
    assert.equal(lock.status(), "lost", name)
    assert.equal(lock.lossSignal.aborted, true, name)
  }
})

test("forged acknowledgment before release is unexpected holder loss", async (context) => {
  const runtime = await mkdtemp(join(tmpdir(), "momi-lock-forged-ack-"))
  context.after(() => rm(runtime, { recursive: true, force: true }))
  const holderScript = [
    `process.stdout.write(${JSON.stringify(LOCK_READY_MARKER)},()=>{`,
    "process.stdin.resume();setTimeout(()=>",
    `process.stdout.write(${JSON.stringify(LOCK_RELEASED_MARKER)}),20);});`,
  ].join("")
  const lock = await acquireCanaryControlLock({
    PATH: process.env.PATH, XDG_RUNTIME_DIR: runtime,
  }, { holderScript })
  if (!lock.lossSignal.aborted) await new Promise<void>((resolve) =>
    lock.lossSignal.addEventListener("abort", () => resolve(), { once: true }))
  await assert.rejects(lock.release(), /already lost/)
  assert.equal(lock.status(), "lost")
})

test("SIGKILL immediately before release never becomes expected close", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "momi-lock-pending-close-"))
  context.after(() => rm(root, { recursive: true, force: true }))
  for (let iteration = 0; iteration < 25; iteration += 1) {
    const runtime = join(root, String(iteration))
    await mkdir(runtime, { mode: 0o700 })
    const lock = await acquireCanaryControlLock({
      PATH: process.env.PATH, XDG_RUNTIME_DIR: runtime,
    })
    process.kill(lock.holderPid, "SIGKILL")
    const release = lock.release()
    assert.equal(lock.status(), "releasing")
    await assert.rejects(release)
    assert.equal(lock.status(), "lost")
    assert.equal(lock.lossSignal.aborted, true)
  }
})
