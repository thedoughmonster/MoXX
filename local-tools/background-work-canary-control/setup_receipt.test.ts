import assert from "node:assert/strict"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { claimSetupReceipt } from "./claim_setup_receipt.ts"
import { SETUP_RECEIPT_SCHEMA, SETUP_STAGE_ORDER } from "./setup_preflight_constants.ts"
import type { SetupBinding } from "./setup_preflight_types.ts"
import { writeSetupFailureReceipt } from "./write_setup_failure_receipt.ts"
import { writeSetupReceipt } from "./write_setup_receipt.ts"

const now = Date.parse("2026-08-02T18:00:00.000Z")
const binding: SetupBinding = {
  releaseSha: "a".repeat(40),
  projectIdentitySha256: "b".repeat(64),
  linkageIdentitySha256: "c".repeat(64),
  flockCapabilitySha256: "d".repeat(64),
  queryIdentitySha256: "e".repeat(64),
  nativeCliSha256: "f".repeat(64),
  nodeVersion: "24.14.0", pnpmVersion: "11.7.0", supabaseCliVersion: "2.109.1",
}

async function createReceiptRoot() {
  const root = await mkdtemp(join(tmpdir(), "momi-setup-receipt-"))
  await mkdir(join(root, "state"), { mode: 0o700 })
  return join(root, "state")
}

test("claims one exact setup receipt once and rejects replay", async () => {
  const root = await createReceiptRoot()
  try {
    const receipt = await writeSetupReceipt(root, {
      ...binding, schemaVersion: SETUP_RECEIPT_SCHEMA, status: "ready", stage: "receipt",
      startedAtUtc: new Date(now).toISOString(),
      expiresAtUtc: new Date(now + 60_000).toISOString(), durationMs: 10,
      providerWorkBegan: true, hostedMutationPossible: false,
      completedStages: SETUP_STAGE_ORDER,
    })
    const current = join(root, "setup/setup-current.json")
    const saved = `${current}.saved`
    await copyFile(current, saved)
    assert.equal((await claimSetupReceipt(root, binding, now + 1)).receiptSha256,
      receipt.receiptSha256)
    await copyFile(saved, current)
    await assert.rejects(claimSetupReceipt(root, binding, now + 2), /ReceiptReused/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test("rejects SHA, project, query, host-capability, and expiry mismatches", async () => {
  for (const [key, value] of [
    ["releaseSha", "9".repeat(40)],
    ["projectIdentitySha256", "9".repeat(64)],
    ["linkageIdentitySha256", "9".repeat(64)],
    ["queryIdentitySha256", "9".repeat(64)],
    ["flockCapabilitySha256", "9".repeat(64)],
  ] as const) {
    const root = await createReceiptRoot()
    try {
      await writeSetupReceipt(root, {
        ...binding, schemaVersion: 1, status: "ready", stage: "receipt",
        startedAtUtc: new Date(now).toISOString(),
        expiresAtUtc: new Date(now + 1_000).toISOString(), durationMs: 1,
        providerWorkBegan: true, hostedMutationPossible: false,
        completedStages: SETUP_STAGE_ORDER,
      })
      await assert.rejects(claimSetupReceipt(root, { ...binding, [key]: value }, now + 1),
        /ReceiptMismatch/, key)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
  const root = await createReceiptRoot()
  try {
    await writeSetupReceipt(root, {
      ...binding, schemaVersion: 1, status: "ready", stage: "receipt",
      startedAtUtc: new Date(now).toISOString(), expiresAtUtc: new Date(now + 1).toISOString(),
      durationMs: 1, providerWorkBegan: true, hostedMutationPossible: false,
      completedStages: SETUP_STAGE_ORDER,
    })
    await assert.rejects(claimSetupReceipt(root, binding, now + 2), /ReceiptExpired/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test("rejects receipt tampering and retains no sensitive material", async () => {
  const root = await createReceiptRoot()
  try {
    const receipt = await writeSetupReceipt(root, {
      ...binding, schemaVersion: 1, status: "ready", stage: "receipt",
      startedAtUtc: new Date(now).toISOString(),
      expiresAtUtc: new Date(now + 1_000).toISOString(), durationMs: 1,
      providerWorkBegan: true, hostedMutationPossible: false,
      completedStages: SETUP_STAGE_ORDER,
    })
    const text = await readFile(receipt.receiptPath, "utf8")
    for (const forbidden of [
      "postgresql://", "pooler.supabase.com", "192.0.2.10", "secret-value",
      "select * from", "provider-payload", "Error: stack",
    ]) assert.equal(text.includes(forbidden), false, forbidden)
    const current = join(root, "setup/setup-current.json")
    await writeFile(current, (await readFile(current, "utf8")).replace('"durationMs":1',
      '"durationMs":2'))
    await assert.rejects(claimSetupReceipt(root, binding, now + 1), /ReceiptMismatch/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test("failure receipts retain only bounded sanitized blocker diagnostics", async () => {
  const root = await createReceiptRoot()
  try {
    const receipt = await writeSetupFailureReceipt(root, {
      schemaVersion: 1, status: "blocked", releaseSha: "a".repeat(40),
      stage: "linkage", errorCategory: "LinkageDnsFailed", childExitCode: null,
      sqlstate: null, startedAtUtc: new Date(now).toISOString(), durationMs: 25,
      providerWorkBegan: false, hostedMutationPossible: false,
    })
    assert.match(receipt.receiptSha256, /^[0-9a-f]{64}$/)
    assert.equal(receipt.receiptPath.startsWith(root), true)
    const text = await readFile(receipt.receiptPath, "utf8")
    assert.match(text, /"errorCategory":"LinkageDnsFailed"/)
    for (const forbidden of ["postgresql://", "pooler.supabase.com", "192.0.2.10", "secret",
      "select *", "provider-payload", "stack"]) {
      assert.equal(text.includes(forbidden), false, forbidden)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
