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
