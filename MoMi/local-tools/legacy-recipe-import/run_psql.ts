import { spawnSync } from "node:child_process"

export function runPsql(sql: string, environment: NodeJS.ProcessEnv): string {
  const result = spawnSync("psql", [
    "-X", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet",
    "--tuples-only", "--no-align",
  ], {
    input: sql,
    env: environment,
    encoding: "utf8",
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw new Error(`psql could not complete: ${result.error.message}`)
  if (result.status !== 0) throw new Error("psql rejected a sealed import statement")
  return String(result.stdout).trim()
}
