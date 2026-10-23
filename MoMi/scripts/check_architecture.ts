import { findDatabaseObjectAuthorityViolations } from
  "./architecture/find_database_object_authority_violations.ts"
import { findBroadSchemaOverlapReportViolations } from
  "./architecture/find_broad_schema_overlap_report_violations.ts"
import { workspaceRoot } from "./architecture/paths.ts"
import { validateArchitectureWithDiagnostics } from
  "./diagnostics/validate_architecture_with_diagnostics.ts"

const architecture = await validateArchitectureWithDiagnostics()
const databaseAuthorityViolations = await findDatabaseObjectAuthorityViolations(
  workspaceRoot,
  process.env.MOMI_VALIDATION_BASE_SHA ?? "origin/dev",
  process.env.MOMI_VALIDATION_HEAD_SHA ?? "HEAD",
)
if (databaseAuthorityViolations.length > 0) {
  throw new Error(
    `Database object authority violations:\n- ${databaseAuthorityViolations.join("\n- ")}`,
  )
}
const overlapViolations = await findBroadSchemaOverlapReportViolations(
  workspaceRoot,
)
if (overlapViolations.length > 0) {
  throw new Error(
    `Broad schema overlap report violations:\n- ${overlapViolations.join("\n- ")}`,
  )
}

console.log(
  `Architecture valid: ${architecture.services.length} services, ` +
    `${architecture.functions.length} functions.`,
)
