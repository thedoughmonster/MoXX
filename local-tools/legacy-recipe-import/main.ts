import { run } from "./run.ts"

try {
  await run(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
}
