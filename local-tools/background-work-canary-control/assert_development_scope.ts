import { DEV_ENVIRONMENT, DEV_PROJECT_REF } from "./constants.ts"
import type { CliOptions, RawCliOptions } from "./types.ts"

export function assertDevelopmentScope(options: RawCliOptions): CliOptions {
  if (options.environment !== DEV_ENVIRONMENT) {
    throw new Error(`--env must be exactly ${DEV_ENVIRONMENT}`)
  }
  if (options.projectRef !== DEV_PROJECT_REF) {
    throw new Error("--project-ref must match the approved development project")
  }
  return {
    environment: DEV_ENVIRONMENT,
    projectRef: DEV_PROJECT_REF,
  }
}
