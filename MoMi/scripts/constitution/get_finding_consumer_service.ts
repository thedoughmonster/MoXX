import type { ConstitutionFinding } from "./types.ts"

export function getFindingConsumerService(finding: ConstitutionFinding): string {
  return finding.evidence.consumer_service ??
    finding.evidence.service_key ??
    "unclassified"
}
