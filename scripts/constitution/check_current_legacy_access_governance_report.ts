import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { workspaceRoot } from "../architecture/paths.ts"
import { readJson } from "../architecture/read_json.ts"
import { buildLegacyAccessGovernanceReport } from
  "./build_legacy_access_governance_report.ts"
import { loadTargetAccessBaselineFingerprints } from
  "./load_target_access_baseline_fingerprints.ts"
import { renderLegacyAccessGovernanceReport } from
  "./render_legacy_access_governance_report.ts"
import { validateLegacyAccessGovernanceReport } from
  "./validate_legacy_access_governance_report.ts"

export async function checkCurrentLegacyAccessGovernanceReport(): Promise<void> {
  const sourceText = await readFile(join(
    workspaceRoot, "docs", "service-access-debt-baseline.json",
  ), "utf8")
  const sourceSchema = await readJson<object>(join(
    workspaceRoot, "schemas", "service-access-debt-baseline-v1.schema.json",
  ))
  const reportSchema = await readJson<object>(join(
    workspaceRoot, "schemas", "legacy-access-governance-report-v1.schema.json",
  ))
  const expected = buildLegacyAccessGovernanceReport({ sourceText, sourceSchema,
    trustedFingerprints: loadTargetAccessBaselineFingerprints() })
  const artifactPath = join(
    workspaceRoot, "docs", "legacy-access-governance-report.json",
  )
  let artifactText: string
  try {
    artifactText = await readFile(artifactPath, "utf8")
  } catch (error) {
    throw new Error("legacy_report_artifact_stale", { cause: error })
  }
  let artifact: unknown
  try {
    artifact = JSON.parse(artifactText)
  } catch (error) {
    throw new Error("legacy_report_artifact_stale", { cause: error })
  }
  validateLegacyAccessGovernanceReport(
    artifact as typeof expected, reportSchema, expected,
  )
  if (artifactText.replaceAll("\r\n", "\n") !==
    renderLegacyAccessGovernanceReport(expected)) {
    throw new Error("legacy_report_artifact_stale")
  }
}
