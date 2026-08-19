import { buildCurrentBroadSchemaOverlapReport } from
  "./architecture/build_current_broad_schema_overlap_report.ts"
import { findBroadSchemaOverlapReportViolations } from
  "./architecture/find_broad_schema_overlap_report_violations.ts"
import { findDatabaseObjectAuthorityViolations } from
  "./architecture/find_database_object_authority_violations.ts"
import { workspaceRoot } from "./architecture/paths.ts"

const candidate = process.argv[2] ?? "HEAD"
const base = process.argv[3] ?? "origin/dev"
const upstream = await findDatabaseObjectAuthorityViolations(
  workspaceRoot, base, candidate,
)
if (upstream.length > 0) throw new Error(
  `Database object authority violations:\n- ${upstream.join("\n- ")}`,
)
const diagnostics = await findBroadSchemaOverlapReportViolations(
  workspaceRoot, candidate,
)
if (diagnostics.length > 0) throw new Error(
  `Broad schema overlap report violations:\n- ${diagnostics.join("\n- ")}`,
)
const report = await buildCurrentBroadSchemaOverlapReport(
  workspaceRoot, candidate,
)
console.log(`Broad schema overlap report valid: ${report.counts.broad_declarations} ` +
  `declarations, ${report.counts.rows} rows, input ${report.input_digest}, ` +
  `report ${report.report_digest}.`)
