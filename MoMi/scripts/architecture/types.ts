import type { ImplementationStatus, OwnedDataset, ServiceDeployment, ServiceType } from
  "./service_manifest_types.ts"
import type { ServiceTestImpactMetadata } from
  "./service_test_impact_types.ts"
import type { ExternalFunctionAuthority } from
  "./external_function_authority_types.ts"
import type { RetirementManifest } from "./retirement_types.ts"
import type { WorkspaceConfig } from "./workspace_types.ts"

export type { RetirementManifest } from "./retirement_types.ts"
export type { WorkspaceConfig } from "./workspace_types.ts"

export type ConsumedContract = {
  service: string
  contract: string
}

export type ServiceManifest = {
  schema_version: 1
  service_key: string
  purpose: string
  kind: "source_adapter" | "core_capability" | "destination_adapter"
  service_type?: ServiceType
  lifecycle_status: "active" | "retiring" | "retired"
  implementation_status?: ImplementationStatus
  functions: string[]
  contracts: {
    provides: string[]
    consumes: ConsumedContract[]
  }
  database: {
    read: string[]
    write: string[]
  }
  network: { outbound_hosts: string[] }
  secrets: string[]
  configuration?: string[]
  deployment?: ServiceDeployment
  test_impact?: ServiceTestImpactMetadata
  runtime_dependencies: string[]
  approved_packages: string[]
  owned_dataset?: OwnedDataset
}

export type FunctionManifest = {
  function_key: string
  contract_version: number
  purpose: string
  owner_service: string
  function_type: string
  capability: string
  boundary: string
  runtime: string
  route_path: string
  authentication_policy_key: string
  entrypoint: string
  input_schema: string
  output_schema: string
  capability_model?: {
    schema_version: 1
    called_contracts: ConsumedContract[]
  }
  probe?: {
    method: "GET" | "OPTIONS"
    acceptable_statuses: number[]
  }
  required_capabilities: string[]
  declared_side_effects: string[]
}

export type LoadedService = {
  directory: string
  manifest: ServiceManifest
}

export type LoadedFunction = {
  adapter_directory: string
  source_directory: string
  manifest_directory: string
  slug: string
  service: LoadedService
  manifest: FunctionManifest
}

export type SourceModule = {
  path: string
  service_key: string
  source: string
  imports: string[]
}

export type Architecture = {
  workspace: WorkspaceConfig
  services: LoadedService[]
  functions: LoadedFunction[]
  modules: SourceModule[]
  retirements: RetirementManifest[]
  externalFunctionAuthorities: ExternalFunctionAuthority[]
}
