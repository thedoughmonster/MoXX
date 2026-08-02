import assert from "node:assert/strict"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { resolveRuntimeExecutables } from "./resolve_runtime_executables.ts"

test("runtime executable resolver returns only absolute safe fixed names", async () => {
  const bin = await mkdtemp(join(tmpdir(), "momi-runtime-bin-"))
  try {
    await chmod(bin, 0o700)
    for (const name of ["git", "pnpm", "flock"]) {
      await writeFile(join(bin, name), "#!/bin/sh\n", { mode: 0o500 })
    }
    const resolved = await resolveRuntimeExecutables({ PATH: bin })
    assert.deepEqual(resolved, {
      gitExecutable: join(bin, "git"), pnpmExecutable: join(bin, "pnpm"),
      flockExecutable: join(bin, "flock"),
    })
    await assert.rejects(resolveRuntimeExecutables({ PATH: "relative/bin" }))
  } finally {
    await rm(bin, { recursive: true, force: true })
  }
})
