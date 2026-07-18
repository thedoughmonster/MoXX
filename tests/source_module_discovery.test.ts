import assert from "node:assert/strict"
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { collectTypeScriptFiles } from
  "../scripts/architecture/collect_typescript_files.ts"

test("rejects service source symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-service-source-"))
  try {
    const target = join(root, "target.ts")
    await writeFile(target, "export const value = 1\n")
    await symlink(target, join(root, "linked.ts"))
    await assert.rejects(
      () => collectTypeScriptFiles(root),
      /service source must not be a symlink/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("rejects unscanned executable service source", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-service-source-"))
  try {
    for (const name of ["hidden.js", "hidden.py", "hidden.graphql"]) {
      await writeFile(join(root, name), "unscanned\n")
      await assert.rejects(
        () => collectTypeScriptFiles(root),
        /unsupported service source asset/,
      )
      await rm(join(root, name))
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
