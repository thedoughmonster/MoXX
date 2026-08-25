import type { CompactReceipt } from "./types.ts"

export function renderAgentValidationSummary(
  receipt: CompactReceipt,
  receiptPath: string,
): string {
  const failed = receipt.commands.filter((item) => item.status !== 0)
  const disposition = receipt.counts.hard_failed > 0 ? "FAIL" : "PASS"
  const lines = [
    `Validation ${disposition}: ${receipt.counts.commands} checks in ${receipt.duration_ms}ms`,
    ...receipt.commands.map((item) =>
      `- ${item.status === 0 ? "pass" : "fail"} [${item.enforcement}] ${item.id} (${item.duration_ms}ms, exit ${item.status})`
    ),
  ]
  for (const command of failed) {
    const heading = command.enforcement === "advisory" ? "Advisory" : "Failure"
    lines.push(``, `${heading}: ${command.id}`)
    const diagnostics = command.diagnostics ?? []
    if (diagnostics.length === 0) lines.push("  (no diagnostic output)")
    for (const diagnostic of diagnostics) {
      const repeated = diagnostic.occurrences > 1
        ? ` (${diagnostic.occurrences} equivalent occurrences)`
        : ""
      lines.push(`  ${diagnostic.identity}${repeated}: ${diagnostic.message}`)
      if (diagnostic.locations.length > 0) {
        const remaining = diagnostic.location_count - diagnostic.locations.length
        const total = diagnostic.location_count_capped
          ? `${diagnostic.location_count} or more total in raw logs`
          : `${diagnostic.location_count} total in raw logs`
        const suffix = remaining > 0 || diagnostic.location_count_capped
          ? ` (+${remaining} more affected; ${total})`
          : ""
        lines.push(`  locations: ${diagnostic.locations.join(", ")}${suffix}`)
      }
    }
    if ((command.additional_diagnostics ?? 0) > 0) {
      const qualifier = command.additional_diagnostics_capped ? " or more" : ""
      lines.push(`  +${command.additional_diagnostics}${qualifier} additional distinct diagnostics in raw logs`)
    }
    if (command.advisory) {
      const action = "regenerate" in command.advisory
        ? command.advisory.regenerate
        : command.advisory.remediate
      lines.push(`  remediate: ${action}`)
    }
    const paths = [command.stdout_path, command.stderr_path].filter(Boolean)
    if (paths.length > 0) lines.push(`  inspect: cat -- ${paths.join(" ")}`)
  }
  lines.push(`Receipt: ${receiptPath}`, "Raw logs: .momi/logs/")
  return `${lines.join("\n")}\n`
}
