import { runExport } from "./run_export.ts"

try {
  await runExport(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL export failed")
  process.exitCode = 1
}
