import { spawnSync } from "node:child_process"
import { basename } from "node:path"

import type { ProcessOutput } from "./types.ts"

export function runProcess(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  output: ProcessOutput,
): string {
  const stdio = output === "capture" ? ["ignore", "pipe", "pipe"] as const :
    output === "inherit" ? ["ignore", "inherit", "inherit"] as const :
    ["ignore", "ignore", "inherit"] as const
  const result = spawnSync(executable, args, {
    env: environment,
    encoding: "utf8",
    stdio,
    windowsHide: true,
  })
  const name = basename(executable)
  if (result.error) throw new Error(`${name} could not be started: ${result.error.message}`)
  if (result.status !== 0) {
    const outcome = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`
    throw new Error(`${name} failed with ${outcome}`)
  }
  return output === "capture" ? String(result.stdout).trim() : ""
}
