import type { WorkspaceConfig } from "./architecture/types.ts"
import { inspectSourceQualityFile } from "./inspect_source_quality_file.ts"
import type { SourceQualityDiagnostic } from "./source_quality_types.ts"

export function inspectChangedSourceQuality(
  path: string,
  source: string,
  workspace: WorkspaceConfig,
): SourceQualityDiagnostic[] {
  return inspectSourceQualityFile(path, source, workspace.policies)
}
