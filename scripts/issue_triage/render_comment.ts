import type { AuthoritativeTriage } from "./types.ts"

export function renderComment(triage: AuthoritativeTriage, marker: string): string {
  const relationships = triage.relationships.length === 0
    ? ["- None identified."]
    : triage.relationships.map((relationship) =>
      `- #${relationship.issue_number} - ${relationship.type}; ` +
        `${relationship.direction}; ${relationship.authority}: ${relationship.rationale}`
    )
  return [
    marker,
    "## Automated feature triage",
    "",
    `- Issue type: **${triage.issue_type}**`,
    `- Feature: **${triage.feature.title}** (\`${triage.feature.id}\`)`,
    `- Safe parallel work (deterministic): **${triage.safe_parallel ? "yes" : "no"}**`,
    `- Confidence: **${triage.confidence}**`,
    "",
    "### Relationships",
    "",
    ...relationships,
    "",
    `Rationale: ${triage.rationale}`,
    "",
    "_Generated from bounded read-only context; references were verified before write._",
  ].join("\n")
}
