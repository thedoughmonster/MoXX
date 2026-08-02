import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { glob, readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { test } from "node:test"

import { createProgramHarness } from "./create_program_harness.test_fixture.ts"
import { runCanaryControlProgram } from "./run_canary_control_program.ts"

const script = "local:background-work-canary-control"
const command = "node local-tools/background-work-canary-control/main.ts"
const execFileAsync = promisify(execFile)

test("package exposes exactly one manual invocation and automation stays unaware", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"))
  assert.equal(pkg.scripts[script], command)
  assert.equal(Object.values(pkg.scripts).filter((value) => value === command).length, 1)
  const candidates = glob([
    ".github/**/*", "services/**/*", "supabase/**/*", "workspace.json",
  ], { exclude: ["supabase/.temp/**"] })
  for await (const path of candidates) {
    try {
      const source = await readFile(path, "utf8")
      assert.equal(source.includes(script), false, path)
      assert.equal(source.includes(command), false, path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EISDIR") throw error
    }
  }
})

test("main is the sole composition entry and contains no configurable authority", async () => {
  const source = await readFile(
    "local-tools/background-work-canary-control/main.ts", "utf8",
  )
  assert.match(source, /invokeCanaryControlMain\(process\.argv\.slice\(2\), import\.meta\.url\)/)
  assert.doesNotMatch(source,
    /mode|threshold|timing|run.?id|credential|database.?url|sql|target/i)
})

test("a complete offline run leaves the released repository status unchanged", async () => {
  const harness = await createProgramHarness()
  try {
    const before = (await execFileAsync("git", [
      "status", "--porcelain=v1", "--untracked-files=all",
    ])).stdout
    const result = await runCanaryControlProgram([
      "--env", "dev", "--project-ref", "xtbraqnlskmqxinjxxdn",
    ], process.cwd(), harness.dependencies)
    const after = (await execFileAsync("git", [
      "status", "--porcelain=v1", "--untracked-files=all",
    ])).stdout
    assert.equal(result.exitCode, 0)
    assert.equal(after, before)
    assert.equal(result.envelope?.finalReceiptPath.startsWith(process.cwd()), false)
    const forbidden = [".", "momi"].join("")
    for await (const path of glob("local-tools/background-work-canary-control/**/*")) {
      try {
        assert.equal((await readFile(path, "utf8")).includes(forbidden), false, path)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EISDIR") throw error
      }
    }
  } finally {
    await harness.source.cleanup()
  }
})
