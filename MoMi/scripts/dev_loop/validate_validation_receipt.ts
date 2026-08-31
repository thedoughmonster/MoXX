import { repositoryHardCheckIds } from "./repository_validation_contract.ts"
import type { ValidationReceipt } from "./types.ts"

export function validateValidationReceipt(value: unknown): ValidationReceipt {
  const receipt = value as ValidationReceipt
  const commands = Array.isArray(receipt?.commands) ? receipt.commands : []
  const expectedCommands = receipt?.gate === "full"
    ? repositoryHardCheckIds.map((id) => ({ id, enforcement: "hard_stop" }))
      .concat(
        { id: "source-quality-soft-limit", enforcement: "advisory" },
        { id: "quality-report", enforcement: "advisory" },
      )
    : [
      { id: "focused-tests", enforcement: "hard_stop" },
      { id: "source-quality", enforcement: "hard_stop" },
      { id: "quality-report-validity", enforcement: "hard_stop" },
      { id: "source-quality-soft-limit", enforcement: "advisory" },
      { id: "quality-report", enforcement: "advisory" },
    ]
  const planMismatch = commands.length !== expectedCommands.length ||
    commands.some((item, index) =>
      item.id !== expectedCommands[index]?.id ||
      item.enforcement !== expectedCommands[index]?.enforcement
    )
  const hardPassed = commands.filter((item) =>
    item.enforcement === "hard_stop" && item.status === 0
  ).length
  const hardFailed = commands.filter((item) =>
    item.enforcement === "hard_stop" && item.status !== 0
  ).length
  const advisoryPassed = commands.filter((item) =>
    item.enforcement === "advisory" && item.status === 0
  ).length
  const advisoryFindings = commands.filter((item) =>
    item.enforcement === "advisory" && item.status !== 0
  ).length
  const invalidCommand = commands.some((item) => {
    const advisory = item.advisory
    const advisoryKeys = Object.keys(advisory ?? {}).sort().join(",")
    const validAdvisory = item.enforcement === "advisory" &&
      ((item.id === "quality-report" &&
        advisoryKeys === "path,regenerate,rule" &&
        advisory?.rule === "quality-report-freshness" &&
        advisory.path === "docs/quality-metrics.json" &&
        advisory.regenerate === "pnpm quality:generate") ||
        (item.id === "source-quality-soft-limit" &&
          advisoryKeys === "path,remediate,rule" &&
          advisory?.rule === "source-quality-soft-limit" &&
          advisory.path === "." && advisory.remediate ===
            "Refactor reported handwritten files to 120 lines or fewer"))
    const hardExcerpt = item.enforcement === "hard_stop" && item.status !== 0
    const advisoryExcerpt = item.enforcement === "advisory" && item.status !== 0
    const diagnostics = Array.isArray(item.diagnostics) ? item.diagnostics : []
    const invalidDiagnostic = diagnostics.some((diagnostic) =>
      !/^diagnostic-[0-9a-f]{12}$/u.test(diagnostic.identity ?? "") ||
      typeof diagnostic.message !== "string" || diagnostic.message.length > 300 ||
      !Array.isArray(diagnostic.locations) ||
      diagnostic.locations.length > 12 ||
      diagnostic.locations.some((location) => typeof location !== "string") ||
      !Number.isInteger(diagnostic.location_count) ||
      diagnostic.location_count < diagnostic.locations.length ||
      (diagnostic.location_count_capped !== undefined &&
        diagnostic.location_count_capped !== true) ||
      !Number.isInteger(diagnostic.occurrences) || diagnostic.occurrences < 1
    )
    return !item.id || !Number.isInteger(item.status) ||
      !Number.isInteger(item.duration_ms) || item.duration_ms < 0 ||
      (item.enforcement !== "hard_stop" && !validAdvisory) ||
      (item.enforcement === "hard_stop" && advisory !== undefined) ||
      (hardExcerpt !== (typeof item.failure_excerpt === "string")) ||
      (advisoryExcerpt !== (typeof item.advisory_excerpt === "string")) ||
      !/^[0-9a-f]{64}$/u.test(item.stdout_sha256 ?? "") ||
      !/^[0-9a-f]{64}$/u.test(item.stderr_sha256 ?? "") ||
      ((item.status !== 0) !== Array.isArray(item.diagnostics)) ||
      invalidDiagnostic || diagnostics.length > 8 ||
      (item.additional_diagnostics !== undefined &&
        (!Number.isInteger(item.additional_diagnostics) ||
          item.additional_diagnostics < 1)) ||
      (item.additional_diagnostics_capped !== undefined &&
        (item.additional_diagnostics_capped !== true ||
          item.additional_diagnostics === undefined)) ||
      (item.failure_excerpt?.length ?? 0) > 2000 ||
      (item.advisory_excerpt?.length ?? 0) > 2000
  })
  if (
    receipt?.schema_version !== 2 || receipt.kind !== "validation" ||
    receipt.required_job !== "validate-final" ||
    receipt.evidence_scope !== "exact_committed_head" ||
    (receipt.gate !== "full" && receipt.gate !== "path_scoped") ||
    !/^[1-9][0-9]*$/.test(receipt.run_log?.run_id ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.base_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.head_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.base_tree ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.head_tree ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.development_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.development_tree ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.production_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.production_tree ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.identities?.diff_sha256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.identities?.impact_sha256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.identities?.plan_sha256 ?? "") ||
    !Array.isArray(receipt.commands) || commands.length === 0 ||
    planMismatch ||
    invalidCommand || receipt.counts?.commands !== commands.length ||
    receipt.counts.hard_passed !== hardPassed ||
    receipt.counts.hard_failed !== hardFailed ||
    receipt.counts.advisory_passed !== advisoryPassed ||
    receipt.counts.advisory_findings !== advisoryFindings ||
    receipt.duration_ms !== commands.reduce((sum, item) => sum + item.duration_ms, 0)
  ) throw new Error("Invalid authoritative validation receipt")
  return receipt
}
