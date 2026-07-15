import {
  ISOLATED_TARGET_PATTERN,
  PROJECT_REF_PATTERN,
  QUARTER_PATTERN,
  RUN_ID_PATTERN,
} from "./constants.ts"
import type { CliOptions, WorkspaceConfig } from "./types.ts"

export function validateRequest(options: CliOptions, workspace: WorkspaceConfig): void {
  if (options.environment !== "dev" && options.environment !== "prod") {
    throw new Error("--env must be dev or prod")
  }
  if (!PROJECT_REF_PATTERN.test(options.projectRef)) {
    throw new Error("--project-ref must be a 20-letter project reference")
  }
  if (workspace.environments[options.environment].project_ref !== options.projectRef) {
    throw new Error("--project-ref does not match --env in workspace.json")
  }
  if (options.resumeRunId && !RUN_ID_PATTERN.test(options.resumeRunId)) {
    throw new Error("--resume is not a valid run identifier")
  }
  if (options.archiveId && !RUN_ID_PATTERN.test(options.archiveId)) {
    throw new Error("--archive is not a valid archive identifier")
  }
  if (options.operation === "restore-drill") {
    if (!options.quarter || !QUARTER_PATTERN.test(options.quarter)) {
      throw new Error("--quarter must use YYYY-Q1 through YYYY-Q4")
    }
    if (!options.isolatedTarget || !ISOLATED_TARGET_PATTERN.test(options.isolatedTarget)) {
      throw new Error("--isolated-target must begin with momi_restore_drill_")
    }
  }
}
