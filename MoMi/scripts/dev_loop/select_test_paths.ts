import { existsSync } from "node:fs"

import type { ImpactClass } from "./types.ts"

export function selectTestPaths(
  classifications: Record<ImpactClass, string[]>,
  affectedServices: string[],
  affectedFunctions: string[],
): string[] {
  const selected = new Set([
    "tests/dev_loop_determinism.test.ts",
    "tests/dev_loop_release_plan.test.ts",
    "tests/retired_development_protocol.test.ts",
  ])
  for (const paths of Object.values(classifications)) {
    for (const path of paths) {
      if (
        path.startsWith("tests/") && path.endsWith(".test.ts") && existsSync(path)
      ) selected.add(path)
    }
  }
  const changedPaths = Object.values(classifications).flat()
  if (changedPaths.some((path) =>
    path.startsWith("tests/fixtures/legacy-debt-exclusion/") ||
    path === "tests/legacy_debt_exclusion_test_support.ts" ||
    path === "docs/service-access-debt-baseline.json" ||
    path === "docs/legacy-access-governance-report.json"
  )) selected.add("tests/legacy_debt_exclusion.test.ts")
  for (const service of affectedServices) {
    selected.add(`services/${service}/**/*.test.ts`)
  }
  for (const slug of affectedFunctions) {
    selected.add(`supabase/functions/${slug}/**/*.test.ts`)
  }
  if (
    classifications.workflow.length > 0 ||
    classifications.repository_tooling.some((path) =>
      /(?:release|deploy|dev_loop|run_(?:release|deploy|impact|check|receipt))/
        .test(path)
    )
  ) {
    selected.add("tests/release_coordinator.test.ts")
    selected.add("tests/release_migration_gate.test.ts")
    selected.add("tests/deployment_authority.test.ts")
    selected.add("tests/deployment_credentials.test.ts")
    selected.add("tests/validation_workflow_baseline.test.ts")
  }
  return [...selected].sort()
}
