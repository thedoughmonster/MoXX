import type { FinalArtifactInput,
  FinalArtifactReceipt,
  FinalArtifactWriteOptions } from "./final_artifact_types.ts"
import { invalidateStagedFinalArtifact } from "./invalidate_staged_final_artifact.ts"
import { publishStagedFinalArtifact } from "./publish_staged_final_artifact.ts"
import { stageFinalArtifact } from "./stage_final_artifact.ts"

export async function writeFinalArtifact(
  input: FinalArtifactInput,
  options: FinalArtifactWriteOptions = {},
): Promise<FinalArtifactReceipt> {
  const staged = await stageFinalArtifact(input, options.preservedInvalidated)
  try {
    options.beforePublish?.()
  } catch (error) {
    try { await invalidateStagedFinalArtifact(staged) } catch { /* preserve staged file */ }
    throw error
  }
  return await publishStagedFinalArtifact(staged, options.preservedInvalidated)
}
