import { readOption } from "../read_option.ts"
import { parseRetirementSelection } from "./parse_retirement_selection.ts"
import type { DeploymentOptions, EnvironmentKey } from "./types.ts"

export function parseDeploymentOptions(): DeploymentOptions {
  const environment = readOption("env", "")
  const services = readOption("services", "").split(",").filter(Boolean).sort()
  const retireFunctions = parseRetirementSelection(readOption("retire-functions", ""))
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("--env must be dev or prod")
  }
  if (
    services.some((service) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(service))
  ) throw new Error("--services requires a comma-separated service list")
  return { environment: environment as EnvironmentKey, services, retireFunctions }
}
