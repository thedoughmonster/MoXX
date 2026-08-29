import type { Architecture } from "../architecture/types.ts"
import { classifyPath } from "./classify_path.ts"
import { repositoryCheckScripts } from "./repository_validation_contract.ts"
import { selectTestPaths } from "./select_test_paths.ts"
import type { CheckCommand, ImpactClass, ImpactPlan } from "./types.ts"
const classes: ImpactClass[] = ["architecture", "docs",
  "manifest", "migration", "repository_tooling", "runtime", "unknown", "workflow"]
export function buildImpactPlan(
  paths: string[],
  architecture: Architecture,
  migrationOwners: Map<string, string>,
): ImpactPlan {
  const classifications = Object.fromEntries(
    classes.map((kind) => [kind, [] as string[]]),
  ) as Record<ImpactClass, string[]>
  const services = new Set<string>()
  for (const path of [...paths].sort()) {
    classifications[classifyPath(path)].push(path)
    const service = path.match(/^services\/([^/]+)\//)?.[1]
    if (service) services.add(service)
    const slug = path.match(/^supabase\/functions\/([^/]+)\//)?.[1]
    const owner = architecture.functions.find((item) => item.slug === slug)
      ?.service.manifest.service_key
    if (owner) services.add(owner)
    const migrationOwner = migrationOwners.get(path)
    if (migrationOwner) services.add(migrationOwner)
    if (path.startsWith("supabase/migrations/") && !migrationOwner) {
      classifications.unknown.push(path)
    }
  }
  const affectedServices = [...services].sort()
  const affectedFunctions = architecture.functions.filter((item) =>
    services.has(item.service.manifest.service_key)
  ).map((item) => item.slug).sort()
  const migrations = classifications.migration.map((path) =>
    path.match(/^supabase\/migrations\/(\d{14})_/)?.[1] ?? path
  ).sort()
  const fullClasses: ImpactClass[] = ["runtime", "architecture", "manifest",
    "migration", "unknown"]
  const full = fullClasses.some((kind) => classifications[kind].length > 0)
  const tests = selectTestPaths(
    classifications,
    affectedServices,
    affectedFunctions,
  )
  const focused: CheckCommand = {
    id: "focused-tests",
    command: "node",
    args: ["--test", ...tests],
    enforcement: "hard_stop",
  }
  const sourceQualityAdvisory: CheckCommand = {
    id: "source-quality-soft-limit", command: "node",
    args: ["scripts/check_source_quality_soft_limit.ts"], enforcement: "advisory",
    advisory: { rule: "source-quality-soft-limit", path: ".",
      remediate: "Refactor reported handwritten files to 120 lines or fewer" },
  }
  const qualityReport: CheckCommand = { id: "quality-report", command: "node",
    args: ["scripts/check_quality_report.ts"], enforcement: "advisory",
    advisory: { rule: "quality-report-freshness",
      path: "docs/quality-metrics.json", regenerate: "pnpm quality:generate" } }
  return {
    schema_version: 1,
    classifications,
    affected_services: affectedServices,
    affected_functions: affectedFunctions,
    migrations,
    iteration_checks: [focused],
    final_gate: full
      ? {
        kind: "full",
        reason: `Full gate selected for ${fullClasses.filter((kind) =>
          classifications[kind].length > 0
        ).join(", ")} impact.`,
        checks: [
          ...repositoryCheckScripts.map((script) => ({
            id: script.replace(/^check_|\.ts$/gu, ""),
            command: "node",
            args: [`scripts/${script}`],
            enforcement: "hard_stop" as const,
          })),
          { id: "tests", command: "node",
            args: ["scripts/run_discovered_tests.ts", "--service", "all"],
            enforcement: "hard_stop" },
          sourceQualityAdvisory,
          qualityReport,
        ],
      }
      : {
        kind: "path_scoped",
        reason: "Only docs, workflows, or repository tooling changed.",
        checks: [
          focused,
          {
            id: "source-quality",
            command: "node",
            args: ["scripts/check_source_quality.ts"],
            enforcement: "hard_stop",
          },
          {
            id: "quality-report-validity",
            command: "node",
            args: ["scripts/check_quality_report_validity.ts"],
            enforcement: "hard_stop",
          },
          sourceQualityAdvisory,
          qualityReport,
        ],
      },
    release: {
      database: migrations.length > 0
        ? "supabase_cli_preview_apply_parity" : "none",
      hosted_inventory: paths.some((path) => path.startsWith("external-functions/"))
        ? "development_full_parity" : "none",
      services: affectedServices,
      functions: affectedFunctions,
    },
  }
}
