import { readOption } from "../read_option.ts"
import type { DeploymentOptions, EnvironmentKey } from "./types.ts"

export function parseDeploymentOptions(): DeploymentOptions {
  const environment = readOption("env", "")
  const service = readOption("service", "all")
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("--env must be dev or prod")
  }
  return { environment: environment as EnvironmentKey, service }
}
