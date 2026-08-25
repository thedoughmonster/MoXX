import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from
  "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"

import { canonicalJson } from "../scripts/dev_loop/canonical_json.ts"
import { momiFixReceiptPath, momiFixes } from
  "../scripts/momi_fix/registrations.ts"
import { runMomiFix } from "../scripts/momi_fix/run_momi_fix.ts"

test("writes exactly the canonical receipt returned to the caller", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-receipt-"))
  const output = momiFixes.catalog.outputs[0]
  try {
    await mkdir(dirname(join(root, output)), { recursive: true })
    const receipt = await runMomiFix(["run", "catalog"], root,
      async (_root, kind) => {
        await writeFile(join(root, output), "generated\n")
        return { changed: true, command: "pnpm catalog:generate", kind, path: output }
      })
    const bytes = await readFile(join(root, momiFixReceiptPath), "utf8")
    assert.equal(bytes, `${canonicalJson(receipt)}\n`)
    assert.equal(bytes.includes("timestamp"), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("removes a stale receipt before a failed command", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-failed-receipt-"))
  const receiptPath = join(root, momiFixReceiptPath)
  try {
    await mkdir(dirname(receiptPath), { recursive: true })
    await writeFile(receiptPath, "stale success\n")
    await assert.rejects(runMomiFix(["run", "quality"], root, async () => {
      throw new Error("generator failed")
    }), /generator failed/u)
    await assert.rejects(readFile(receiptPath), { code: "ENOENT" })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("rejects a symlinked receipt ancestor before external mutation", async () => {
  const container = await mkdtemp(join(tmpdir(), "momi-fix-receipt-link-"))
  const root = join(container, "repo")
  let invoked = false
  try {
    await mkdir(root)
    await mkdir(join(container, "outside-momi"))
    await symlink(join(container, "outside-momi"), join(root, ".momi"))
    await assert.rejects(runMomiFix(["run", "catalog"], root, async () => {
      invoked = true
      throw new Error("must not run")
    }), /path contains symlink: \.momi\/momi-fix-receipt\.json/u)
    assert.equal(invoked, false)
    await assert.rejects(readFile(join(container, "outside-momi",
      "momi-fix-receipt.json")), { code: "ENOENT" })
  } finally {
    await rm(container, { recursive: true, force: true })
  }
})

test("repeats unchanged generation as an idempotent no-op", async () => {
  const root = await mkdtemp(join(tmpdir(), "momi-fix-idempotent-"))
  const output = momiFixes.quality.outputs[0]
  try {
    await mkdir(dirname(join(root, output)), { recursive: true })
    const runner = async (_root: string, kind: "quality") => {
      await writeFile(join(root, output), "stable\n")
      return { changed: true, command: "pnpm quality:generate", kind, path: output }
    }
    const first = await runMomiFix(["run", "quality"], root, runner)
    const second = await runMomiFix(["run", "quality"], root, runner)
    assert.deepEqual(first.changed_paths, [output])
    assert.deepEqual(second.changed_paths, [])
    assert.equal(
      await readFile(join(root, momiFixReceiptPath), "utf8"),
      `${canonicalJson(second)}\n`,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("renders equivalent runs as byte-identical receipts", async () => {
  const rendered: string[] = []
  for (const suffix of ["a", "b"]) {
    const root = await mkdtemp(join(tmpdir(), `momi-fix-deterministic-${suffix}-`))
    const output = momiFixes["debt-lifecycle"].outputs[0]
    try {
      await mkdir(dirname(join(root, output)), { recursive: true })
      const receipt = await runMomiFix(["run", "debt-lifecycle"], root,
        async (_root, kind) => {
          await writeFile(join(root, output), "stable\n")
          return { changed: true, command: "pnpm debt-lifecycle:generate",
            kind, path: output }
        })
      rendered.push(canonicalJson(receipt))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
  assert.equal(rendered[0], rendered[1])
})
