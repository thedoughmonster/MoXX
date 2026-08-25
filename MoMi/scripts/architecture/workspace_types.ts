export type WorkspaceConfig = {
  schema_version: 1
  layout: "transition" | "service_workspaces"
  paths: {
    services: string
    function_adapters: string
    migrations: string
    retirements: string
    external_function_authorities: string
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
