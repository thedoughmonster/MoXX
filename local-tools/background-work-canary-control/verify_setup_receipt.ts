import { lstatSync } from "node:fs"
import { isAbsolute } from "node:path"

import { canonicalJson } from "./canonical_json.ts"
import { readBoundedRegularFile } from "./read_bounded_regular_file.ts"
import { SETUP_RECEIPT_SCHEMA, SETUP_STAGE_ORDER } from "./setup_preflight_constants.ts"
import { SetupPreflightError } from "./setup_preflight_error.ts"
import type {
  SetupReceipt,
  SetupReceiptCore,
  StoredSetupReceipt,
} from "./setup_preflight_types.ts"
import { sha256Text } from "./sha256_text.ts"
import { validateStrictRecord } from "./validate_strict_record.ts"

export function verifySetupReceipt(path: string): SetupReceipt {
  try {
    const info = lstatSync(path)
    const effectiveUser = process.geteuid?.()
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      (info.mode & 0o777) !== 0o600 ||
      (effectiveUser !== undefined && info.uid !== effectiveUser)) throw new Error()
    const text = readBoundedRegularFile(path, 16 * 1024)
    const parsed = JSON.parse(text) as unknown
    const stored = validateStrictRecord(parsed, [
      "schemaVersion", "status", "stage", "releaseSha", "projectIdentitySha256",
      "linkageIdentitySha256", "flockCapabilitySha256", "queryIdentitySha256",
      "nativeCliSha256", "nodeVersion", "pnpmVersion", "supabaseCliVersion",
      "startedAtUtc", "expiresAtUtc", "durationMs", "providerWorkBegan",
      "hostedMutationPossible", "completedStages", "receiptPath", "integritySha256",
    ], "Setup receipt") as StoredSetupReceipt
    const { integritySha256, ...core } = stored
    if (stored.schemaVersion !== SETUP_RECEIPT_SCHEMA || stored.status !== "ready" ||
      stored.stage !== "receipt" || !/^[0-9a-f]{40}$/.test(stored.releaseSha) ||
      !isAbsolute(stored.receiptPath) || stored.providerWorkBegan !== true ||
      stored.hostedMutationPossible !== false || !Number.isSafeInteger(stored.durationMs) ||
      stored.durationMs < 0 || JSON.stringify(stored.completedStages) !==
      JSON.stringify(SETUP_STAGE_ORDER) || ![stored.projectIdentitySha256,
        stored.linkageIdentitySha256, stored.flockCapabilitySha256,
        stored.queryIdentitySha256, stored.nativeCliSha256, integritySha256,
      ].every((hash) => /^[0-9a-f]{64}$/.test(hash)) ||
      integritySha256 !== sha256Text(canonicalJson(core as SetupReceiptCore))) {
      throw new Error()
    }
    return { ...stored, receiptSha256: sha256Text(text) }
  } catch {
    throw new SetupPreflightError("ReceiptMismatch", "receipt")
  }
}
