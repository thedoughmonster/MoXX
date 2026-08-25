import { hashEvidence } from "./hash_evidence.ts"
import { summarizeEvidence } from "./summarize_evidence.ts"
import type { CompactReceipt, ReceiptInput } from "./types.ts"

export function buildCompactReceipt(input: ReceiptInput): CompactReceipt {
  for (const command of input.commands) {
    const advisory = command.advisory
    const advisoryKeys = Object.keys(advisory ?? {}).sort().join(",")
    const validAdvisory = command.enforcement === "advisory" &&
      ((command.id === "quality-report" &&
        advisoryKeys === "path,regenerate,rule" &&
        advisory?.rule === "quality-report-freshness" &&
        advisory.path === "docs/quality-metrics.json" &&
        advisory.regenerate === "pnpm quality:generate") ||
        (command.id === "source-quality-soft-limit" &&
          advisoryKeys === "path,remediate,rule" &&
          advisory?.rule === "source-quality-soft-limit" &&
          advisory.path === "." &&
          advisory.remediate ===
            "Refactor reported handwritten files to 120 lines or fewer"))
    if (
      !command.id || !Number.isInteger(command.status) ||
      !Number.isInteger(command.duration_ms) || command.duration_ms < 0 ||
      (command.enforcement !== "hard_stop" && !validAdvisory) ||
      (command.enforcement === "hard_stop" && advisory !== undefined)
    ) throw new Error(`Invalid command evidence for ${command.id || "(missing)"}`)
  }
  const commands = input.commands.map((command) => {
    const failed = command.status !== 0
    const summary = failed ? summarizeEvidence([
      { inline: command.stderr, path: command.stderr_path },
      { inline: command.stdout, path: command.stdout_path },
    ]) : undefined
    const excerpt = summary?.diagnostics.map((item) => item.message)
      .join("\n").slice(0, 2000) ?? ""
    return {
      id: command.id,
      enforcement: command.enforcement,
      ...(command.advisory ? { advisory: command.advisory } : {}),
      status: command.status,
      duration_ms: command.duration_ms,
      ...(command.stdout_path ? { stdout_path: command.stdout_path } : {}),
      ...(command.stderr_path ? { stderr_path: command.stderr_path } : {}),
      stdout_sha256: command.stdout_sha256 ??
        hashEvidence(command.stdout, command.stdout_path),
      stderr_sha256: command.stderr_sha256 ??
        hashEvidence(command.stderr, command.stderr_path),
      ...(failed ? { diagnostics: summary?.diagnostics ?? [] } : {}),
      ...(summary?.additional ? { additional_diagnostics: summary.additional } : {}),
      ...(summary?.capped ? { additional_diagnostics_capped: true as const } : {}),
      ...(failed && command.enforcement === "hard_stop"
        ? { failure_excerpt: excerpt || "(no failure output)" }
        : {}),
      ...(failed && command.enforcement === "advisory"
        ? { advisory_excerpt: excerpt || "(no advisory output)" }
        : {}),
    }
  })
  return {
    schema_version: 2,
    kind: input.kind,
    identities: {
      ...(input.base_sha ? { base_sha: input.base_sha } : {}),
      ...(input.head_sha ? { head_sha: input.head_sha } : {}),
      ...(input.base_tree ? { base_tree: input.base_tree } : {}),
      ...(input.head_tree ? { head_tree: input.head_tree } : {}),
      ...(input.diff_sha256 ? { diff_sha256: input.diff_sha256 } : {}),
      ...(input.impact_sha256 ? { impact_sha256: input.impact_sha256 } : {}),
      ...(input.plan_sha256 ? { plan_sha256: input.plan_sha256 } : {}),
    },
    counts: {
      commands: commands.length,
      hard_passed: commands.filter((item) =>
        item.enforcement === "hard_stop" && item.status === 0
      ).length,
      hard_failed: commands.filter((item) =>
        item.enforcement === "hard_stop" && item.status !== 0
      ).length,
      advisory_passed: commands.filter((item) =>
        item.enforcement === "advisory" && item.status === 0
      ).length,
      advisory_findings: commands.filter((item) =>
        item.enforcement === "advisory" && item.status !== 0
      ).length,
    },
    duration_ms: commands.reduce((total, item) => total + item.duration_ms, 0),
    run_log: {
      ...(input.run_id ? { run_id: input.run_id } : {}),
      ...(input.log_url ? { log_url: input.log_url } : {}),
    },
    commands,
  }
}
