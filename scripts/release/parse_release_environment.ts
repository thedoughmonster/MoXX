import { readOption } from "../read_option.ts"
import type { EnvironmentKey } from "../deploy/types.ts"

export function parseReleaseEnvironment(): EnvironmentKey {
  const environment = readOption("env", "")
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("--env must be dev or prod")
  }
  return environment
}
