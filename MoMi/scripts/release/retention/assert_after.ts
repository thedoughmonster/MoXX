import type { RetentionSnapshot } from "./assert_snapshot.ts"

export function assertRetentionAfter(
  before: RetentionSnapshot, after: RetentionSnapshot, additions: string[],
): void {
  const expected = [...before.ledger.map((row) => row.version), ...additions].sort()
  if (JSON.stringify(after.ledger.map((row) => row.version)) !== JSON.stringify(expected) ||
      before.ledger.some((row) => after.ledger.find((item) => item.version === row.version)?.sha256 !== row.sha256)) {
    throw new Error("Retention changed preserved history or added unexpected versions")
  }
}
