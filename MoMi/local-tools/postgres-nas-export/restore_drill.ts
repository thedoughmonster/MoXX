import { runRestoreDrill } from "./run_restore_drill.ts"

try {
  await runRestoreDrill(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL restore drill failed")
  process.exitCode = 1
}
