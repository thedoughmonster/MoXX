import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "./architecture/paths.ts"
import { buildDebtLifecycleTrend } from
  "./constitution/build_debt_lifecycle_trend.ts"
import { loadAccessBaseline } from "./constitution/load_access_baseline.ts"
import { loadConstitutionBaseline } from
  "./constitution/load_constitution_baseline.ts"
import { loadDebtLifecycleRegistry } from
  "./constitution/load_debt_lifecycle_registry.ts"
import { renderDebtLifecycleTrend } from
  "./constitution/render_debt_lifecycle_trend.ts"

const access = await loadAccessBaseline()
const constitution = await loadConstitutionBaseline()
const registry = await loadDebtLifecycleRegistry()
const trend = buildDebtLifecycleTrend(
  [...constitution.findings, ...access.findings],
  registry,
)
await writeFile(
  join(workspaceRoot, "docs", "debt-lifecycle-trend.json"),
  renderDebtLifecycleTrend(trend),
  "utf8",
)
console.log("Generated docs/debt-lifecycle-trend.json")
