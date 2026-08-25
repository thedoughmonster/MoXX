import { join } from "node:path"

import { assertSafePath } from "./assert_safe_path.ts"
import {
  PINNED_PACKAGE_TRUST,
} from "./constants.ts"
import { decodeUtf8 } from "./decode_utf8.ts"
import { hashSealedFile } from "./hash_sealed_file.ts"
import { parseChecksumLedger } from "./parse_checksum_ledger.ts"
import { readSealedBytes } from "./read_sealed_bytes.ts"
import { requireLedgerHash } from "./require_ledger_hash.ts"
import { sha256Bytes } from "./sha256_bytes.ts"
import type { AuthenticatedPackage, PackageTrust } from "./types.ts"

export async function authenticatePackage(
  source: string,
  trust: PackageTrust = PINNED_PACKAGE_TRUST,
): Promise<AuthenticatedPackage> {
  const sourceRoot = await assertSafePath(source, "directory")
  const portableRoot = await assertSafePath(join(sourceRoot, "portable"), "directory")
  const sidecar = decodeUtf8(
    await readSealedBytes(join(sourceRoot, "SHA256SUMS.txt.sha256")),
    "SHA256SUMS.txt.sha256",
  ).trim()
  const expectedSidecar = `${trust.ledgerSha256}  SHA256SUMS.txt`
  if (sidecar !== expectedSidecar) throw new Error("Detached package digest is not trusted")
  const ledgerBytes = await readSealedBytes(join(sourceRoot, "SHA256SUMS.txt"))
  if (sha256Bytes(ledgerBytes) !== trust.ledgerSha256) {
    throw new Error("SHA256SUMS.txt does not match the pinned audited digest")
  }
  const ledger = parseChecksumLedger(ledgerBytes)
  if (requireLedgerHash(ledger, "portable/manifest.json") !== trust.manifestSha256) {
    throw new Error("Authenticated ledger has an unexpected portable manifest")
  }
  for (const [path, expectedHash] of Object.entries(trust.databases)) {
    if (requireLedgerHash(ledger, path) !== expectedHash ||
      await hashSealedFile(join(sourceRoot, ...path.split("/"))) !== expectedHash) {
      throw new Error(`Referenced source database failed authentication: ${path}`)
    }
  }
  return {
    sourceRoot, portableRoot, ledger, ledgerSha256: trust.ledgerSha256,
  }
}
