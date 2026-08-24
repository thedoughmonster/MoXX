import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"

import { momiFixes } from "../scripts/momi_fix/registrations.ts"
import { runRegisteredFix } from "../scripts/momi_fix/run_registered_fix.ts"

test("detects changes to an already-dirty declared output", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-dirty-"))
  const fix = momiFixes.catalog
  const output = fix.outputs[0]
  try {
    await mkdir(dirname(join(root, output)), { recursive: true })
    await writeFile(join(root, output), "user-dirty\n")
    const receipt = await runRegisteredFix(root, fix, async (_root, kind) => {
      await writeFile(join(root, output), "generated\n")
      return { changed: true, command: "pnpm catalog:generate", kind, path: output }
    })
    assert.deepEqual(receipt.changed_paths, [output])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test("inventories ignored and nested dot-path outputs by content", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-ignored-"))
  const outputs = [
    ".momi/generated.json",
    "subdir/.ignored",
    "subdir/.hidden/file.json",
  ]
  const fix = { ...momiFixes.catalog, outputs }
  try {
    await writeFile(join(root, ".gitignore"), ".momi/**\n")
    const receipt = await runRegisteredFix(root, fix, async (_root, kind) => {
      for (const output of outputs) {
        await mkdir(dirname(join(root, output)), { recursive: true })
        await writeFile(join(root, output), "{\"ok\":true}\n")
      }
      return { changed: true, command: "pnpm catalog:generate",
        kind, path: outputs[0] }
    })
    assert.deepEqual(receipt.changed_paths, [...outputs].sort())
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("fails when a generator writes outside its declared outputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-outside-"))
  const fix = momiFixes.catalog
  const output = fix.outputs[0]
  try {
    await mkdir(dirname(join(root, output)), { recursive: true })
    await assert.rejects(runRegisteredFix(root, fix, async (_root, kind) => {
      await writeFile(join(root, output), "generated\n")
      await writeFile(join(root, "outside.txt"), "unexpected\n")
      return { changed: true, command: "pnpm catalog:generate", kind, path: output }
    }), /wrote outside declared outputs: outside\.txt/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("preserves a bounded generator command failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-failure-"))
  try {
    await assert.rejects(
      runRegisteredFix(root, momiFixes.quality, async () => {
        throw new Error("fixture generator failed")
      }),
      /fixture generator failed/u,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("rejects a symlinked declared output before generator invocation", async () => {
  const container = await mkdtemp(join(tmpdir(), "momi-fix-output-link-"))
  const root = join(container, "repo")
  let invoked = false
  try {
    await mkdir(join(root, "docs"), { recursive: true })
    await writeFile(join(container, "outside.md"), "outside\n")
    await symlink(join(container, "outside.md"),
      join(root, momiFixes.catalog.outputs[0]))
    await assert.rejects(runRegisteredFix(root, momiFixes.catalog, async () => {
      invoked = true
      throw new Error("must not run")
    }), /path contains symlink: docs\/service-catalog\.md/u)
    assert.equal(invoked, false)
  } finally {
    await rm(container, { recursive: true, force: true })
  }
})

test("rejects a symlinked declared-output ancestor", async () => {
  const container = await mkdtemp(join(tmpdir(), "momi-fix-parent-link-"))
  const root = join(container, "repo")
  try {
    await mkdir(root)
    await mkdir(join(container, "outside-docs"))
    await symlink(join(container, "outside-docs"), join(root, "docs"))
    await assert.rejects(
      runRegisteredFix(root, momiFixes.catalog, async () => {
        throw new Error("must not run")
      }),
      /path contains symlink: docs\/service-catalog\.md/u,
    )
  } finally {
    await rm(container, { recursive: true, force: true })
  }
})
