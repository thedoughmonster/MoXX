import { join } from "node:path"

import { assertLinkedDev } from "./assert_linked_dev.ts"
import { buildSupabaseQueryArgs } from "./build_supabase_query_args.ts"
import { decodeUtf8 } from "./decode_utf8.ts"
import { readSealedBytes } from "./read_sealed_bytes.ts"
import { runPsql } from "./run_psql.ts"
import { runSupabaseCli } from "./run_supabase_cli.ts"
import type { ExecutionBackend, PlanOutput, SqlPlanFile } from "./types.ts"

export async function runDatabaseFile(
  output: PlanOutput,
  file: SqlPlanFile,
  backend: ExecutionBackend,
): Promise<string> {
  if (backend.kind === "supabase-cli") {
    await assertLinkedDev(backend.workspaceRoot)
  }
  const path = join(output.directory, file.file)
  const bytes = await readSealedBytes(path, file.sha256, file.bytes)
  if (backend.kind === "psql") {
    return runPsql(decodeUtf8(bytes, file.file), backend.environment)
  }
  return await runSupabaseCli(
    buildSupabaseQueryArgs(path, backend.workspaceRoot),
    backend.workspaceRoot, backend.environment,
  )
}
