import type { ConstitutionFinding } from "./types.ts"
import type { DebtLifecycleRegistry } from "./debt_lifecycle_types.ts"
import { indexDebtLifecycleRecords } from "./index_debt_lifecycle_records.ts"
import { selectDebtRemediationIssue } from "./select_debt_remediation_issue.ts"

export function findDebtLifecycleViolations(
  findings: ConstitutionFinding[],
  registry: DebtLifecycleRegistry,
  target: DebtLifecycleRegistry | undefined,
  today = new Date().toISOString().slice(0, 10),
): string[] {
  const violations: string[] = []
  const records = indexDebtLifecycleRecords(registry)
  const current = new Set(findings.map((finding) => finding.fingerprint))
  const day = 24 * 60 * 60 * 1000
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  const asOfTime = Date.parse(`${registry.policy.as_of}T00:00:00Z`)
  if (!Number.isFinite(todayTime) || !Number.isFinite(asOfTime)) {
    violations.push("lifecycle policy has an invalid check or as-of date")
  }
  if (asOfTime > todayTime) {
    violations.push("lifecycle report as-of date cannot be in the future")
  }
  for (const finding of findings) {
    const record = records.get(finding.fingerprint)
    if (!record) {
      violations.push(`missing lifecycle metadata for ${finding.fingerprint}`)
    } else if (record.remediation_issue !== selectDebtRemediationIssue(finding)) {
      violations.push(`${finding.fingerprint} maps to the wrong remediation issue`)
    }
  }
  for (const fingerprint of records.keys()) {
    if (!current.has(fingerprint)) {
      violations.push(`stale lifecycle metadata for ${fingerprint}`)
    }
  }
  const sortedIssues = registry.records.map((record) => record.remediation_issue)
  if (sortedIssues.some((issue, index) => index > 0 && issue <= sortedIssues[index - 1])) {
    violations.push("lifecycle records must be ordered by remediation issue")
  }
  for (const record of registry.records) {
    if (record.fingerprints.some((item, index) =>
      index > 0 && item <= record.fingerprints[index - 1]
    )) violations.push(`#${record.remediation_issue} fingerprints are not ordered`)
    const introduced = Date.parse(`${record.introduced_on}T00:00:00Z`)
    const reviewed = Date.parse(`${record.reviewed_on}T00:00:00Z`)
    const nextReview = Date.parse(`${record.next_review_on}T00:00:00Z`)
    const expires = Date.parse(`${record.expires_on}T00:00:00Z`)
    if ([introduced, reviewed, nextReview, expires].some((item) =>
      !Number.isFinite(item)
    )) {
      violations.push(`#${record.remediation_issue} has an invalid lifecycle date`)
      continue
    }
    if (!(introduced <= reviewed && reviewed < nextReview && nextReview <= expires)) {
      violations.push(`#${record.remediation_issue} lifecycle dates are out of order`)
    }
    if ((nextReview - reviewed) / day > registry.policy.review_max_days) {
      violations.push(`#${record.remediation_issue} exceeds the review interval`)
    }
    if ((expires - reviewed) / day > registry.policy.expiry_max_days) {
      violations.push(`#${record.remediation_issue} exceeds the expiry interval`)
    }
    if (todayTime > nextReview) {
      violations.push(`#${record.remediation_issue} review is overdue`)
    }
    if (todayTime > expires) {
      violations.push(`#${record.remediation_issue} lifecycle metadata is expired`)
    }
    if (record.risk !== "high") {
      violations.push(`#${record.remediation_issue} does not retain accepted high risk`)
    }
    if (record.accountable_owner !== "Zac") {
      violations.push(`#${record.remediation_issue} does not retain accountable owner Zac`)
    }
    if (reviewed > asOfTime) {
      violations.push(`#${record.remediation_issue} review is after report as-of`)
    }
    const lastReview = record.reviews.at(-1)
    if (!lastReview || lastReview.reviewed_on !== record.reviewed_on) {
      violations.push(`#${record.remediation_issue} latest review is not recorded`)
    }
    if (record.reviews.some((review, index) => index > 0 &&
      review.reviewed_on <= record.reviews[index - 1].reviewed_on
    )) violations.push(`#${record.remediation_issue} review history is not append ordered`)
  }
  if (!target) return violations
  const targetRecords = indexDebtLifecycleRecords(target)
  for (const [fingerprint, prior] of targetRecords) {
    const next = records.get(fingerprint)
    if (!next) continue
    const prefix = next.reviews.slice(0, prior.reviews.length)
    if (JSON.stringify(prefix) !== JSON.stringify(prior.reviews)) {
      violations.push(`${fingerprint} rewrites accepted review history`)
    }
    const priorMetadata = { ...prior, fingerprints: [], reviews: [] }
    const nextMetadata = { ...next, fingerprints: [], reviews: [] }
    if (JSON.stringify(priorMetadata) !== JSON.stringify(nextMetadata) &&
      next.reviews.length <= prior.reviews.length
    ) violations.push(`${fingerprint} changes lifecycle metadata without renewal`)
  }
  return violations
}
