import { join } from "node:path"

import { buildCurrentBroadSchemaOverlapReport } from
  "./architecture/build_current_broad_schema_overlap_report.ts"
import { findDatabaseObjectAuthorityViolations } from
  "./architecture/find_database_object_authority_violations.ts"
import { readJson } from "./architecture/read_json.ts"
import { renderBroadSchemaOverlapReport } from
  "./architecture/render_broad_schema_overlap_report.ts"
import { validateBroadSchemaOverlapReport } from
  "./architecture/validate_broad_schema_overlap_report.ts"
import { workspaceRoot } from "./architecture/paths.ts"

const candidate = process.argv[2] ?? "HEAD"
const base = process.argv[3] ?? "origin/dev"
const upstream = await findDatabaseObjectAuthorityViolations(
  workspaceRoot, base, candidate,
)
if (upstream.length > 0) throw new Error(
  `Database object authority violations:\n- ${upstream.join("\n- ")}`,
)
const report = await buildCurrentBroadSchemaOverlapReport(
  workspaceRoot, candidate,
)
const schema = await readJson<object>(join(
  workspaceRoot, "schemas", "broad-schema-overlap-report-v1.schema.json",
))
const diagnostics = validateBroadSchemaOverlapReport(report, schema)
if (diagnostics.length > 0) throw new Error(
  `Broad schema overlap report violations:\n- ${diagnostics.map((item) =>
    JSON.stringify(item)).join("\n- ")}`,
)
process.stdout.write(renderBroadSchemaOverlapReport(report))
