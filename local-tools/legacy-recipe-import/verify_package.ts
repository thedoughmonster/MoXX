import { parseExecutionStatus } from "./parse_execution_status.ts"
import { runDatabaseFile } from "./run_database_file.ts"
import { runFailureMarker } from "./run_failure_marker.ts"
import type { ExecutionBackend, LoadedPackage, PlanOutput } from "./types.ts"
import { validatePlanOrder } from "./validate_plan_order.ts"

export async function verifyPackage(
  pkg: LoadedPackage,
  output: PlanOutput,
  backend: ExecutionBackend,
): Promise<void> {
  try {
    let result = ""
    const files = validatePlanOrder(output, "verification-query")
    for (const file of files) result = await runDatabaseFile(output, file, backend)
    const status = parseExecutionStatus(result)
    if (status !== "verified") throw new Error(`Legacy recipe verification status: ${status}`)
  } catch (error) {
    try {
      await runFailureMarker(output, backend, "verification-failure")
    } catch {
      // Preserve the original database or reconciliation error.
    }
    throw error
  }
  console.log(JSON.stringify({
    import_run_id: pkg.importRunId,
    verified_exports: pkg.exports.length,
    payload_checks: pkg.exports.length * 2,
  }, null, 2))
}
