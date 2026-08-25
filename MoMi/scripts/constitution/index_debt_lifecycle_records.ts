import type {
  DebtLifecycleRecord,
  DebtLifecycleRegistry,
} from "./debt_lifecycle_types.ts"

export function indexDebtLifecycleRecords(
  registry: DebtLifecycleRegistry,
): Map<string, DebtLifecycleRecord> {
  const result = new Map<string, DebtLifecycleRecord>()
  const issues = new Set<number>()
  for (const record of registry.records) {
    if (issues.has(record.remediation_issue)) {
      throw new Error(
        `duplicate remediation issue #${record.remediation_issue} in lifecycle registry`,
      )
    }
    issues.add(record.remediation_issue)
    for (const fingerprint of record.fingerprints) {
      if (result.has(fingerprint)) {
        throw new Error(`duplicate lifecycle fingerprint ${fingerprint}`)
      }
      result.set(fingerprint, record)
    }
  }
  return result
}
