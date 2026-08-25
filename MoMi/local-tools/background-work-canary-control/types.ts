import type { DEV_ENVIRONMENT, DEV_PROJECT_REF } from "./constants.ts"

export type RawCliOptions = {
  environment: string
  projectRef: string
}

export type CliOptions = {
  environment: typeof DEV_ENVIRONMENT
  projectRef: typeof DEV_PROJECT_REF
}
