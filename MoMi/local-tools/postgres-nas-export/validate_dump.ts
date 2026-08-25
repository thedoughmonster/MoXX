import { buildPgEnvironment } from "./build_pg_environment.ts"
import { runProcess } from "./run_process.ts"

export function validateDump(pgRestore: string, dumpPath: string): void {
  runProcess(pgRestore, ["--list", dumpPath], buildPgEnvironment("none"), "silent")
}
