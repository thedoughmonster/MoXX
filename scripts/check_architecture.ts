import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { findDatabaseObjectAuthorityViolations } from
  "./architecture/find_database_object_authority_violations.ts"
import { findBroadSchemaOverlapReportViolations } from
  "./architecture/find_broad_schema_overlap_report_violations.ts"
import { workspaceRoot } from "./architecture/paths.ts"

const architecture = await validateArchitecture()
const databaseAuthorityViolations = await findDatabaseObjectAuthorityViolations(
  workspaceRoot,
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
