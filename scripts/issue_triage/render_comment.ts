import type { IssueTriage } from "./types.ts"

export function renderComment(triage: IssueTriage, marker: string): string {
  const relationships = triage.relationships.length === 0
    ? ["- None identified."]
    : triage.relationships.map((relationship) =>
      `- #${relationship.issue_number} - ${relationship.type}: ${relationship.rationale}`
    )
  return [
    marker,
    "## Automated feature triage",
    "",
    `- Issue type: **${triage.issue_type}**`,
    `- Feature: **${triage.feature.title}** (\`${triage.feature.id}\`)`,
    `- Safe parallel work: **${triage.safe_parallel ? "yes" : "no"}**`,
    `- Confidence: **${triage.confidence}**`,
    "",
    "### Explicit relationships",
    "",
    ...relationships,
    "",
    `Rationale: ${triage.rationale}`,
    "",
    "_Generated from bounded read-only context; references were verified before write._",
  ].join("\n")
}
