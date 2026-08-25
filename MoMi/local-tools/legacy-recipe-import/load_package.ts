import { join } from "node:path"

import { authenticatePackage } from "./authenticate_package.ts"
import { IMPORTER_VERSION, PINNED_PACKAGE_TRUST } from "./constants.ts"
import { loadRepairExport } from "./load_repair_export.ts"
import { loadSourceExports } from "./load_source_exports.ts"
import { readManifest } from "./read_manifest.ts"
import { readSealedBytes } from "./read_sealed_bytes.ts"
import { stableUuid } from "./stable_uuid.ts"
import type { LoadedPackage, PackageTrust, PreservationManifest } from "./types.ts"
import { verifyPortableLayout } from "./verify_portable_layout.ts"

export async function loadPackage(
  source: string,
  trust: PackageTrust = PINNED_PACKAGE_TRUST,
): Promise<LoadedPackage> {
  const sealed = await authenticatePackage(source, trust)
  const manifestPath = join(sealed.portableRoot, "manifest.json")
  const manifestBytes = await readSealedBytes(manifestPath, trust.manifestSha256)
  const { manifest: portable, raw } = readManifest(manifestPath, manifestBytes, trust)
  await verifyPortableLayout(sealed.portableRoot, portable, sealed.ledger)
  const manifestSha256 = trust.manifestSha256
  const importRunId = stableUuid(`manifest:${manifestSha256}:${IMPORTER_VERSION}`)
  const sourceExports = await loadSourceExports(
    sealed.portableRoot, portable, sealed.ledger, importRunId,
  )
  const repairExport = await loadRepairExport(
    sealed.portableRoot, portable, sealed.ledger, importRunId,
  )
  const exports = [...sourceExports, repairExport]
  const manifest: PreservationManifest = {
    schema_version: 1,
    package_id: `legacy-recipe-${manifestSha256.slice(0, 24)}`,
    created_at: new Date(portable.generated_at_utc).toISOString(),
    dataset: "legacy_recipe",
    exports: exports.map((item) => item.manifest),
    metadata: { checksum_ledger_sha256: sealed.ledgerSha256 },
  }
  return {
    sourceRoot: sealed.sourceRoot, manifestPath, manifestSha256,
    ledgerSha256: sealed.ledgerSha256, importRunId, manifest,
    rawManifest: raw, exports,
  }
}
