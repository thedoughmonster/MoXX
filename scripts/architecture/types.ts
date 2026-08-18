import type { ImplementationStatus, OwnedDataset, ServiceDeployment, ServiceType } from
  "./service_manifest_types.ts"

export type WorkspaceConfig = {
  schema_version: 1
  layout: "transition" | "service_workspaces"
  paths: {
    services: string
    function_adapters: string
    migrations: string
    retirements: string
  }
  toolchain: {
    node: string
    pnpm: string
    supabase_cli: string
    deno: string
  }
  environments: Record<"dev" | "prod", {
    branch: string
    project_ref: string
  }>
  database_schemas: string[]
  policies: {
    max_handwritten_lines: number
    hard_max_handwritten_lines: number
    minimum_shared_consumers: number
  }
}

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

export type RetirementManifest = {
  schema_version: 1
  function_slug: string
  owner_service: string
  reason: string
  replacement: string
  environments: Array<"dev" | "prod">
  remove_after: string
  removal_evidence?: {
    issue_url: string
    verified_at: string
    summary: string
  }
}

export type Architecture = {
  workspace: WorkspaceConfig
  services: LoadedService[]
  functions: LoadedFunction[]
  modules: SourceModule[]
  retirements: RetirementManifest[]
}
