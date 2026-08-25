import { join } from "node:path"

import { buildDumpArgs } from "./build_dump_args.ts"
import { buildPgEnvironment } from "./build_pg_environment.ts"
import { buildPortableDumpArgs } from "./build_portable_dump_args.ts"
import { DUMP_FILE, REPOSITORY_ROOT, SOURCE_EXPORT_FILE, WAREHOUSE_EXPORT_FILE } from
  "./constants.ts"
import { runProcess } from "./run_process.ts"
import { scanManualSource } from "./scan_manual_source.ts"
import { selectPortableSchemas } from "./select_portable_schemas.ts"
import { stageManualExports } from "./stage_manual_exports.ts"
import type { PgTools, RunState } from "./types.ts"

export async function stageExportArtifacts(
  tools: PgTools,
  state: RunState,
  staging: string,
  manualExportDir?: string,
): Promise<void> {
  const environment = buildPgEnvironment("export")
  const portable = selectPortableSchemas(state.schemas)
  runProcess(tools.pgDump, buildDumpArgs(join(staging, DUMP_FILE), state.schemas),
    environment, "inherit")
  runProcess(tools.pgDump,
    buildPortableDumpArgs(join(staging, SOURCE_EXPORT_FILE), portable.source),
    environment, "inherit")
  runProcess(tools.pgDump,
    buildPortableDumpArgs(join(staging, WAREHOUSE_EXPORT_FILE), portable.warehouse),
    environment, "inherit")
  state.manual_files = manualExportDir ? await stageManualExports(
    staging,
    await scanManualSource(manualExportDir, REPOSITORY_ROOT),
  ) : []
}
