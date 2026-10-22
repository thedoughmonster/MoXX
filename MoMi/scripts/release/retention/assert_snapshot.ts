import type { RetentionApproval } from "./types.ts"

export type RetentionSnapshot = {
  ledger: { version: string; sha256: string }[]
  ledger_sha256: string
  objects_sha256: string
}

export function assertRetentionSnapshot(
  approval: RetentionApproval, snapshot: RetentionSnapshot, localVersions: string[],
): void {
  const versions = snapshot.ledger.map((entry) => entry.version)
  const deferred = localVersions.filter((version) =>
    !versions.includes(version) && !approval.migrations.includes(version)).sort()
  if (snapshot.ledger_sha256 !== approval.before.ledger_sha256 ||
      snapshot.objects_sha256 !== approval.before.objects_sha256 ||
      JSON.stringify(versions) !== JSON.stringify(approval.before.versions) ||
      JSON.stringify(deferred) !== JSON.stringify(approval.deferred_versions) ||
      approval.migrations.some((version) => versions.includes(version))) {
    throw new Error("Retention before-state or deferred inventory changed")
  }
}
