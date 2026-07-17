import { createHash } from "node:crypto"

import type { ConstitutionFindingInput } from "./types.ts"

export function fingerprintFinding(
  finding: ConstitutionFindingInput,
): string {
  const evidence = Object.fromEntries(
    Object.entries(finding.evidence).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    ),
  )
  const identity = JSON.stringify({
    rule_version: finding.rule_version,
    rule_id: finding.rule_id,
    subject: finding.subject,
    evidence,
  })
  return `sha256:${createHash("sha256").update(identity).digest("hex")}`
}
