import type { ValidationReceipt } from "./types.ts"

export function validateValidationReceipt(value: unknown): ValidationReceipt {
  const receipt = value as ValidationReceipt
  const commands = Array.isArray(receipt?.commands) ? receipt.commands : []
  const expectedCommands = receipt?.gate === "full"
    ? [
      { id: "full-repository", enforcement: "hard_stop" },
      { id: "quality-report", enforcement: "advisory" },
    ]
    : [
      { id: "focused-tests", enforcement: "hard_stop" },
      { id: "source-quality", enforcement: "hard_stop" },
      { id: "quality-report-validity", enforcement: "hard_stop" },
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
    const validAdvisory = item.enforcement === "advisory" &&
      advisory?.rule === "quality-report-freshness" &&
      advisory.path === "docs/quality-metrics.json" &&
      advisory.regenerate === "pnpm quality:generate"
    const hardExcerpt = item.enforcement === "hard_stop" && item.status !== 0
    const advisoryExcerpt = item.enforcement === "advisory" && item.status !== 0
    return !item.id || !Number.isInteger(item.status) ||
      !Number.isInteger(item.duration_ms) || item.duration_ms < 0 ||
      (item.enforcement !== "hard_stop" && !validAdvisory) ||
      (item.enforcement === "hard_stop" && advisory !== undefined) ||
      (hardExcerpt !== (typeof item.failure_excerpt === "string")) ||
      (advisoryExcerpt !== (typeof item.advisory_excerpt === "string")) ||
      (item.failure_excerpt?.length ?? 0) > 2000 ||
      (item.advisory_excerpt?.length ?? 0) > 2000
  })
  if (
    receipt?.schema_version !== 2 || receipt.kind !== "validation" ||
    receipt.required_job !== "validate-final" ||
    (receipt.gate !== "full" && receipt.gate !== "path_scoped") ||
    !/^[1-9][0-9]*$/.test(receipt.run_log?.run_id ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.base_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.head_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.base_tree ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.head_tree ?? "") ||
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
