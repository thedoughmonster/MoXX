import { repositoryCheckScripts } from "./repository_validation_contract.ts"
import type { CheckCommand } from "./types.ts"

export async function buildRepositoryChecks(
  service: string,
  includeAdvisory = false,
): Promise<CheckCommand[]> {
  const checks: CheckCommand[] = repositoryCheckScripts.map((script) => ({
    id: script.replace(/^check_|\.ts$/gu, ""),
    command: process.execPath,
    args: [`scripts/${script}`],
    enforcement: "hard_stop" as const,
  }))
  checks.push({
    id: service === "all" ? "tests" : `tests-${service}`,
    command: process.execPath,
    args: ["scripts/run_discovered_tests.ts", "--service", service],
    enforcement: "hard_stop",
  })
  if (includeAdvisory) checks.push({
    id: "quality-report",
    command: process.execPath,
    args: ["scripts/check_quality_report.ts"],
    enforcement: "advisory",
    advisory: {
      rule: "quality-report-freshness",
      path: "docs/quality-metrics.json",
      regenerate: "pnpm quality:generate",
    },
  })
  return checks
}
