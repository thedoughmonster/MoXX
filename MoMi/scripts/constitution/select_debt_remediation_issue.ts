import type { ConstitutionFinding } from "./types.ts"

const archiveEvaluationFingerprints = new Set([
  "sha256:5088e5d4445d20f43c21b5133187780781b928efbeb1f09f8966849981728864",
  "sha256:f57cc451df89a4a1c2d570a29c1dc87d43fe092ebd121feb52bbffeadfd23f46",
  "sha256:f86d4d30f02e1792fb5a40ce8eedd0c0ea657f028c55a055604b2270bb61498e",
])

export function selectDebtRemediationIssue(finding: ConstitutionFinding): number {
  const evidence = finding.evidence
  if (
    evidence.owner_service === "runtime-registry" ||
    evidence.owner_service === "momi-event-routing" ||
    finding.rule_id === "dynamic_event_name"
  ) return 196
  if ([evidence.owner_service, evidence.consumer_service].some((service) =>
    service === "order-alerting" || service === "slack-order-delivery"
  )) return 195
  if (archiveEvaluationFingerprints.has(finding.fingerprint)) return 572
  return 194
}
