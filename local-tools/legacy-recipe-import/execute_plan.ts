import { parseExecutionStatus } from "./parse_execution_status.ts"
import { runDatabaseFile } from "./run_database_file.ts"
import { runFailureMarker } from "./run_failure_marker.ts"
import type { ExecutionBackend, PlanOutput } from "./types.ts"
import { validatePlanOrder } from "./validate_plan_order.ts"

export async function executePlan(
  output: PlanOutput,
  backend: ExecutionBackend,
): Promise<void> {
  try {
    let result = ""
    for (const file of validatePlanOrder(output, "import")) {
      result = await runDatabaseFile(output, file, backend)
    }
    const status = parseExecutionStatus(result)
    if (status !== "imported") throw new Error(`Legacy recipe import status: ${status}`)
  } catch (error) {
    try {
      await runFailureMarker(output, backend, "import-failure")
    } catch {
      // Preserve the original database or reconciliation error.
    }
    throw error
  }
}
