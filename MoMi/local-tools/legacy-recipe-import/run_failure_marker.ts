import { runDatabaseFile } from "./run_database_file.ts"
import type { ExecutionBackend, PlanOutput, SqlPlanFile } from "./types.ts"
import { validatePlanOrder } from "./validate_plan_order.ts"

export async function runFailureMarker(
  output: PlanOutput,
  backend: ExecutionBackend,
  phase: Extract<SqlPlanFile["phase"], "import-failure" | "verification-failure">,
): Promise<void> {
  const files = validatePlanOrder(output, phase)
  if (files.length !== 1) throw new Error(`Expected one sealed ${phase} marker`)
  await runDatabaseFile(output, files[0], backend)
}
