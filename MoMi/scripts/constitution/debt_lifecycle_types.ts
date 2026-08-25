import type { ConstitutionFinding } from "./types.ts"

export type DebtLifecycleReview = {
  reviewed_on: string
  reviewer: string
  decision: "accept" | "renew"
  rationale: string
}

export type DebtLifecycleRecord = {
  remediation_issue: string
  accountable_owner: string
  risk: "low" | "medium" | "high" | "critical"
  temporary_reason: string
  introduced_on: string
  reviewed_on: string
  next_review_on: string
  expires_on: string
  removal_evidence: string
  reviews: DebtLifecycleReview[]
  fingerprints: string[]
}

export type DebtLifecycleRegistry = {
  $schema: string
  schema_version: 2
  authority: {
    decision: "M169-DEBT-014"
    decision_id: string
    accepted_event: string
    content_digest: string
    work_authority: "linear"
  }
  policy: {
    as_of: string
    review_max_days: 30
    expiry_max_days: 90
    issue_closure: "deliberate_owner_action_only"
  }
  records: DebtLifecycleRecord[]
}

export type DebtLifecycleTrend = {
  generated: true
  as_of: string
  purpose: string
  total: number
  oldest_age_days: number
  by_issue: Record<string, number>
  by_owner: Record<string, number>
  by_risk: Record<string, number>
  by_rule: Record<string, number>
  by_consumer_service: Record<string, number>
}

export type DebtLifecycleFinding = ConstitutionFinding & {
  lifecycle: DebtLifecycleRecord
}
