import { runVerify } from "./run_verify.ts"

try {
  await runVerify(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL verification failed")
  process.exitCode = 1
}
