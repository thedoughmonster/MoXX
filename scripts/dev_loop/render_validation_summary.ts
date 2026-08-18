import type { CompactReceipt } from "./types.ts"

export function renderValidationSummary(receipt: CompactReceipt): string {
  const identities = receipt.identities
  const lines = [
    "## Exact validation receipt",
    "",
    `- Base commit: \`${identities.base_sha ?? "missing"}\``,
    `- Base tree: \`${identities.base_tree ?? "missing"}\``,
    `- Head commit: \`${identities.head_sha ?? "missing"}\``,
    `- Head tree: \`${identities.head_tree ?? "missing"}\``,
    `- Diff SHA-256: \`${identities.diff_sha256 ?? "missing"}\``,
    `- Impact SHA-256: \`${identities.impact_sha256 ?? "missing"}\``,
    `- Plan SHA-256: \`${identities.plan_sha256 ?? "missing"}\``,
    `- Hard checks: ${receipt.counts.hard_passed} passed, ${receipt.counts.hard_failed} failed`,
    `- Advisories: ${receipt.counts.advisory_passed} current, ${receipt.counts.advisory_findings} findings`,
  ]
  for (const command of receipt.commands) {
    if (command.enforcement !== "advisory" || !command.advisory) continue
    lines.push(
      "",
      `### Advisory: ${command.advisory.rule}`,
      `- Path: \`${command.advisory.path}\``,
      `- Status: ${command.status === 0 ? "current" : "finding"}`,
      `- Regenerate: \`${command.advisory.regenerate}\``,
    )
  }
  return `${lines.join("\n")}\n`
}
