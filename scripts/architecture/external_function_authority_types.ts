export type ExternalFunctionAuthority = {
  schema_version: 1
  function_slug: string
  owner_repository: string
  owner_service: string
  lifecycle_status: "active"
  environments: Array<{ name: "dev"; project_ref: string }>
  deployment_workflow: ".github/workflows/deploy-dev.yml"
  adapter_path: string
  verify_jwt: boolean
  source_revision: string
  verified_at: string
  valid_until: string
  caller: {
    kind: "database_trigger" | "external_webhook" | "edge_function"
    state: "active" | "policy_disabled"
    evidence_url: string
  }
}
