import { join } from "node:path"

import { loadTargetAccessBaselineFingerprints } from
  "../constitution/load_target_access_baseline_fingerprints.ts"
import { buildBroadSchemaOverlapReport } from
  "./build_broad_schema_overlap_report.ts"
import { buildDatabaseObjectAuthority } from
  "./build_database_object_authority.ts"
import type { BroadSchemaOverlapReport } from
  "./broad_schema_overlap_report_types.ts"
import { loadDatabaseObjectAuthorityRevision } from
  "./load_database_object_authority_revision.ts"
import { readJson } from "./read_json.ts"

export async function buildCurrentBroadSchemaOverlapReport(
  root: string,
  revision = "HEAD",
  trustedBaselineRevision?: string,
): Promise<BroadSchemaOverlapReport> {
  const result = buildDatabaseObjectAuthority(root, revision)
  if (result.diagnostics.length > 0) {
    throw new Error(result.diagnostics.map((item) => JSON.stringify(item)).join("\n"))
  }
  const source = loadDatabaseObjectAuthorityRevision(root, revision)
  const baselineSchema = await readJson<object>(join(
    root, "schemas", "service-access-debt-baseline-v1.schema.json",
  ))
  const authoritySchema = await readJson<object>(join(
    root, "schemas", "database-object-authority-v1.schema.json",
  ))
  return buildBroadSchemaOverlapReport(result.authority, authoritySchema,
    source.legacy_debt.source, baselineSchema,
    loadTargetAccessBaselineFingerprints(trustedBaselineRevision))
}
