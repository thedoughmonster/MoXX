import type { CliOptions, RunState } from "./types.ts"

export function assertStateMatches(
  state: RunState,
  options: CliOptions,
  schemas: string[],
): void {
  if (state.operation !== options.operation || state.environment !== options.environment ||
    state.project_ref !== options.projectRef ||
    state.archive_id !== (options.operation === "export" ? state.run_id : options.archiveId)) {
    throw new Error("Resume state does not match the requested operation and archive")
  }
  if (JSON.stringify(state.schemas) !== JSON.stringify(schemas)) {
    throw new Error("Resume state schemas do not match the authoritative schema list")
  }
  if (state.operation === "export" && state.archive_id !== state.run_id) {
    throw new Error("Export resume state has an invalid archive identifier")
  }
  if (state.operation === "export" &&
    state.manual_exports !== (options.manualExportDir !== undefined)) {
    throw new Error("Resume state does not match manual export inclusion")
  }
  if (state.operation === "restore-drill" &&
    (state.isolated_target !== options.isolatedTarget || state.quarter !== options.quarter)) {
    throw new Error("Resume state does not match the isolated target and quarter")
  }
}
