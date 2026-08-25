import { join } from "node:path"

import { listPortableFiles } from "./list_portable_files.ts"
import { portableRelativePath } from "./portable_relative_path.ts"
import { readSealedBytes } from "./read_sealed_bytes.ts"
import { requireLedgerHash } from "./require_ledger_hash.ts"
import type { ChecksumLedger } from "./types.ts"
import type { PortableManifest } from "./manifest_types.ts"

export async function verifyPortableLayout(
  portableRoot: string,
  manifest: PortableManifest,
  ledger: ChecksumLedger,
): Promise<void> {
  const expected = [
    "manifest.json", "repair_queries.sql",
    portableRelativePath(manifest.repair_findings.relative_path),
    ...manifest.tables.map((table) => portableRelativePath(table.relative_path)),
  ].sort()
  const actual = await listPortableFiles(portableRoot)
  if (actual.length !== expected.length ||
    actual.some((file, index) => file !== expected[index])) {
    throw new Error("Portable directory differs from the approved sealed allowlist")
  }
  const ledgerPortable = [...ledger.keys()].filter((path) =>
    path.startsWith("portable/")
  ).map((path) => path.slice("portable/".length)).sort()
  if (ledgerPortable.length !== expected.length ||
    ledgerPortable.some((file, index) => file !== expected[index])) {
    throw new Error("Authenticated ledger portable entries differ from the allowlist")
  }
  const repairSql = "portable/repair_queries.sql"
  await readSealedBytes(
    join(portableRoot, "repair_queries.sql"), requireLedgerHash(ledger, repairSql),
  )
}
