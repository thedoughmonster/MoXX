import { createRecoveryClassificationDependencies } from "./create_recovery_classification_dependencies.ts"
import type {
  RecoveryClassificationDependencies,
  RecoveryClassificationResult,
} from "./recovery_classification_types.ts"
import { runPreparedRecoveryClassification } from "./run_prepared_recovery_classification.ts"

export async function runRecoveryClassificationProgram(
  args: string[], repositoryRoot: string,
  dependencies: RecoveryClassificationDependencies = createRecoveryClassificationDependencies(),
): Promise<RecoveryClassificationResult> {
  let runtime
  try { runtime = await dependencies.prepareRuntime(args, repositoryRoot) } catch {
    return { exitCode: 20, stderrCode: "PRE_GUARD_FAILURE", envelope: null }
  }
  return await runPreparedRecoveryClassification(runtime, repositoryRoot, dependencies)
}
