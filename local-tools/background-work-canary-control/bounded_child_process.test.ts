import assert from "node:assert/strict"
import { access, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { CHILD_OUTPUT_LIMIT_BYTES } from "./process_constants.ts"
import { runBoundedChild } from "./run_bounded_child.ts"

test("bounded children return typed outcomes and enforce every process limit", async (context) => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "momi-child-test-"))
  context.after(() => rm(fixtureDirectory, { recursive: true, force: true }))
  const success = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "process.stdout.write('ok')"],
    environment: { PATH: "/usr/bin:/bin" },
  })
  assert.equal(success.outcome.status, "success")
  assert.equal(Buffer.from(success.stdout).toString(), "ok")

  const failed = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "process.stderr.write('private-output');process.exit(7)"],
  })
  assert.equal(failed.outcome.status, "exit_failure")
  assert.equal(failed.outcome.exitCode, 7)
  assert.equal(JSON.stringify(failed.outcome).includes("private-output"), false)

  const timedOut = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "setInterval(() => {}, 1000)"],
    timeoutMs: 40,
  })
  assert.equal(timedOut.outcome.status, "timed_out")

  const controller = new AbortController()
  const escapeMarker = join(fixtureDirectory, "escaped")
  const grandchildScript = [
    "const fs=require('node:fs');",
    `setTimeout(()=>fs.writeFileSync(${JSON.stringify(escapeMarker)},'escaped'),300);`,
    "setInterval(()=>{},1000);",
  ].join("")
  const parentScript = [
    "const {spawn}=require('node:child_process');",
    `spawn(process.execPath,${JSON.stringify(["-e", grandchildScript])},{stdio:'ignore'});`,
    "process.stdout.write('ready');setInterval(()=>{},1000);",
  ].join("")
  setTimeout(() => controller.abort(), 80)
  const cancelled = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", parentScript],
    signal: controller.signal,
  })
  assert.equal(cancelled.outcome.status, "cancelled")
  await new Promise((resolve) => setTimeout(resolve, 400))
  await assert.rejects(access(escapeMarker))

  const capped = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "process.stdout.write('x'.repeat(70000));setInterval(() => {}, 1000)"],
  })
  assert.equal(capped.outcome.status, "output_limit")
  assert.equal(capped.outcome.limitedStream, "stdout")
  assert.equal(capped.stdout.length, CHILD_OUTPUT_LIMIT_BYTES)
  assert.ok(capped.outcome.stdoutBytes > CHILD_OUTPUT_LIMIT_BYTES)

  const stderrCapped = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "process.stderr.write('x'.repeat(70000));setInterval(() => {}, 1000)"],
  })
  assert.equal(stderrCapped.outcome.status, "output_limit")
  assert.equal(stderrCapped.outcome.limitedStream, "stderr")
  assert.equal(stderrCapped.stderr.length, CHILD_OUTPUT_LIMIT_BYTES)

  const environment = await runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))"],
    environment: {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      DATABASE_URL: "private-database-value",
      SUPABASE_ACCESS_TOKEN: "private-token-value",
    },
  })
  assert.deepEqual(JSON.parse(Buffer.from(environment.stdout).toString()), [
    "LANG",
    "PATH",
    "SUPABASE_TELEMETRY_DISABLED",
  ])

  await assert.rejects(
    runBoundedChild({ executable: process.execPath, arguments: [], timeoutMs: 10_001 }),
    /timeout is invalid/,
  )
  const unsafeEnvironment = "private-environment-value"
  await assert.rejects(
    runBoundedChild({
      executable: process.execPath,
      arguments: ["-e", ""],
      environment: { PATH: `/usr/bin\0${unsafeEnvironment}` },
    }),
    (error: Error) => !error.message.includes(unsafeEnvironment),
  )

  const first = runBoundedChild({
    executable: process.execPath,
    arguments: ["-e", "setTimeout(() => {}, 150)"],
  })
  await assert.rejects(
    runBoundedChild({ executable: process.execPath, arguments: ["-e", ""] }),
    /already active/,
  )
  assert.equal((await first).outcome.status, "success")
})
