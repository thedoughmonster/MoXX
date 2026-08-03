import type { RecoveryLineageProof } from "./recovery_types.ts"

export function parseRecoveryLineageProof(value: unknown): readonly RecoveryLineageProof[] {
  if (!Array.isArray(value)) throw new Error("Recovery lineage proof is invalid")
  const rows = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !== "childSha256,edgeSha256,parentSha256") {
      throw new Error("Recovery lineage proof row is invalid")
    }
    const row = entry as Record<string, unknown>
    if ([row.childSha256, row.parentSha256, row.edgeSha256].some((digest) =>
      typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))) {
      throw new Error("Recovery lineage proof fingerprint is invalid")
    }
    return {
      childSha256: row.childSha256 as string,
      parentSha256: row.parentSha256 as string,
      edgeSha256: row.edgeSha256 as string,
    }
  })
  if (new Set(rows.map((row) => row.edgeSha256)).size !== rows.length ||
    rows.some((row, index) => index > 0 && row.edgeSha256 <= rows[index - 1].edgeSha256)) {
    throw new Error("Recovery lineage proof is not canonical")
  }
  return rows
}
