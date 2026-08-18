import type { ImpactClass } from "../dev_loop/types.ts"

export const serviceTestImpactCategories = [
  "local_unit", "local_integration", "provider_contract",
  "consumer_contract", "cross_service_integration", "mandatory_global",
  "risk_triggered",
] as const

export type ServiceTestImpactCategory =
  typeof serviceTestImpactCategories[number]

export type ServiceTestImpactContract = {
  provider_service: string
  contract: string
}

export type ServiceTestImpactSelector = {
  id: string
  test: string
  reason: string
  services: string[]
  contracts: ServiceTestImpactContract[]
  triggers: ImpactClass[]
}

export type ServiceTestImpactMetadata = {
  schema_version: 1
  owner_service: string
  categories: Record<ServiceTestImpactCategory, ServiceTestImpactSelector[]>
}

export type ServiceTestImpactSource = {
  source: string
  owner_service: string
  metadata?: ServiceTestImpactMetadata
}

export type ServiceTestImpactDiagnosticCode =
  | "metadata_absent"
  | "unsupported_version"
  | "owner_mismatch"
  | "categories_missing"
  | "selectors_unsorted"
  | "duplicate_selector_id"
  | "duplicate_selector"
  | "invalid_test_path"
  | "test_missing"
  | "path_escape"
  | "unknown_service"
  | "contract_mismatch"
  | "category_rule_mismatch"
  | "invalid_trigger"
  | "triggers_unsorted"
  | "services_unsorted"
  | "contracts_unsorted"
  | "selection_empty_when_required"

export type ServiceTestImpactDiagnostic = {
  source: string
  selector_id?: string
  field: string
  code: ServiceTestImpactDiagnosticCode
  target: string
}

export type ServiceTestImpactReason = {
  owner_service: string
  category: ServiceTestImpactCategory
  selector_id: string
  reason: string
  matched_triggers: ImpactClass[]
  services: string[]
  contracts: ServiceTestImpactContract[]
}

export type ResolvedServiceTest = {
  test: string
  reasons: ServiceTestImpactReason[]
  source_manifest: string
  schema_version: 1
}

export type ServiceTestImpactResolution = {
  metadata: Array<{
    owner_service: string
    source_manifest: string
    status: "metadata_absent" | "declared"
  }>
  tests: ResolvedServiceTest[]
  diagnostics: ServiceTestImpactDiagnostic[]
}

export class ServiceTestImpactError extends Error {
  readonly diagnostics: ServiceTestImpactDiagnostic[]

  constructor(diagnostics: ServiceTestImpactDiagnostic[]) {
    super("service test-impact metadata is invalid")
    this.name = "ServiceTestImpactError"
    this.diagnostics = diagnostics
  }
}
