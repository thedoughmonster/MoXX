import type { LoadedFunction } from "../architecture/types.ts"

export type EnvironmentKey = "dev" | "prod"

export type DeploymentOptions = {
  environment: EnvironmentKey
  service: string
}

export type HostedFunction = {
  slug: string
  status: string | null
  version: number | null
  verify_jwt: boolean | null
  entrypoint_path: string | null
  ezbr_sha256: string | null
}

export type FunctionAttestation = HostedFunction & {
  function_json_sha256: string
}

export type InventoryResult = {
  environment: EnvironmentKey
  active: string[]
  retired: string[]
  hosted: HostedFunction[]
  missing: string[]
  unexpected: string[]
  expired: string[]
  invalid_metadata: string[]
}

export type ProbeResult = {
  slug: string
  status: number
  ok: boolean
}

export type AdvisorResult = {
  security: Record<string, unknown>[]
  performance: Record<string, unknown>[]
}

export type DeploymentContext = {
  environment: EnvironmentKey
  project_ref: string
  service: string
  functions: LoadedFunction[]
}
