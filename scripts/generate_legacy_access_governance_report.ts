import { readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { readJson } from "./architecture/read_json.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { buildLegacyAccessGovernanceReport } from
  "./constitution/build_legacy_access_governance_report.ts"
import { loadTargetAccessBaselineFingerprints } from
  "./constitution/load_target_access_baseline_fingerprints.ts"
import { renderLegacyAccessGovernanceReport } from
  "./constitution/render_legacy_access_governance_report.ts"
import { validateLegacyAccessGovernanceReport } from
  "./constitution/validate_legacy_access_governance_report.ts"

const sourceText = await readFile(join(
  workspaceRoot, "docs", "service-access-debt-baseline.json",
), "utf8")
const sourceSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "service-access-debt-baseline-v1.schema.json",
))
const reportSchema = await readJson<object>(join(
  workspaceRoot, "schemas", "legacy-access-governance-report-v1.schema.json",
))
const report = buildLegacyAccessGovernanceReport({ sourceText, sourceSchema,
  trustedFingerprints: loadTargetAccessBaselineFingerprints() })
validateLegacyAccessGovernanceReport(report, reportSchema, report)
const destination = join(
  workspaceRoot, "docs", "legacy-access-governance-report.json",
)
const temporary = `${destination}.tmp-${process.pid}`
try {
  await writeFile(temporary, renderLegacyAccessGovernanceReport(report), "utf8")
  await rename(temporary, destination)
} catch (error) {
  await rm(temporary, { force: true })
  throw error
}
console.log(`Generated ${report.source.finding_count} legacy debt evidence rows.`)
