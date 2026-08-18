import type { ConstitutionFinding } from "./types.ts"
import type {
  DebtLifecycleRegistry,
  DebtLifecycleTrend,
} from "./debt_lifecycle_types.ts"
import { getFindingConsumerService } from "./get_finding_consumer_service.ts"
import { indexDebtLifecycleRecords } from "./index_debt_lifecycle_records.ts"

export function buildDebtLifecycleTrend(
  findings: ConstitutionFinding[],
  registry: DebtLifecycleRegistry,
): DebtLifecycleTrend {
  const records = indexDebtLifecycleRecords(registry)
  const byIssue: Record<string, number> = {}
  const byOwner: Record<string, number> = {}
  const byRisk: Record<string, number> = {}
  const byRule: Record<string, number> = {}
  const byService: Record<string, number> = {}
  const asOf = Date.parse(`${registry.policy.as_of}T00:00:00Z`)
  const day = 24 * 60 * 60 * 1000
  let oldestAge = 0
  const increment = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1
  }
  for (const finding of [...findings].sort((left, right) =>
    left.fingerprint.localeCompare(right.fingerprint)
  )) {
    const lifecycle = records.get(finding.fingerprint)
    if (!lifecycle) throw new Error(`Missing lifecycle for ${finding.fingerprint}`)
    increment(byIssue, `#${lifecycle.remediation_issue}`)
    increment(byOwner, lifecycle.accountable_owner)
    increment(byRisk, lifecycle.risk)
    increment(byRule, finding.rule_id)
    increment(byService, getFindingConsumerService(finding))
    const introduced = Date.parse(`${lifecycle.introduced_on}T00:00:00Z`)
    oldestAge = Math.max(oldestAge, Math.floor((asOf - introduced) / day))
  }
  const ordered = (value: Record<string, number>) => Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  )
  return {
    generated: true,
    as_of: registry.policy.as_of,
    purpose: "Review signal only; lower debt counts do not prove correct ownership.",
    total: findings.length,
    oldest_age_days: oldestAge,
    by_issue: ordered(byIssue),
    by_owner: ordered(byOwner),
    by_risk: ordered(byRisk),
    by_rule: ordered(byRule),
    by_consumer_service: ordered(byService),
  }
}
