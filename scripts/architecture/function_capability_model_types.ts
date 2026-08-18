import type { ArchitectureSnapshot } from
  "./architecture_snapshot_identity_types.ts"
import type { ExecutionAuthority } from "./execution_authority_types.ts"

export const functionCapabilityModelSchemaId =
  "https://momi.local/schemas/function-capability-model-v1.schema.json"

export type DirectFunctionCapability = "database_read" | "database_write"

export type FunctionCalledContract = {
  service: string
  contract: string
}

export type FunctionCapabilityEdge = {
  provider: string
  consumer: string
  contract: string
}

export type FunctionEffectKind =
  | "approved_package"
  | "database_read"
  | "database_write"
  | "network_outbound_host"
  | "runtime_dependency"
  | "secret_reference"

export type FunctionTransitiveEffect = {
  effect_kind: FunctionEffectKind
  target: string
  provider_service: string
  source_path: string
  source_pointer: string
  provenance_paths: FunctionCapabilityEdge[][]
}

export type FunctionCapabilityRecord = {
  function_key: string
  owner_service: string
  manifest_path: string
  direct_capabilities: DirectFunctionCapability[]
  called_contracts: FunctionCalledContract[]
  transitive_effects: FunctionTransitiveEffect[]
}

export type FunctionCapabilityModelPayload = {
  $schema: typeof functionCapabilityModelSchemaId
  schema_version: 1
  source_snapshot: ArchitectureSnapshot
  functions: FunctionCapabilityRecord[]
}

export type FunctionCapabilityModel = FunctionCapabilityModelPayload & {
  digest: string
}

export type FunctionCapabilityDiagnosticCode =
  | "called_contract_not_consumed"
  | "called_contract_unknown"
  | "called_contracts_unsorted"
  | "capability_model_absent"
  | "capability_model_shape_invalid"
  | "dependency_cycle"
  | "direct_transitive_conflation"
  | "duplicate_function_key"
  | "duplicate_called_contract"
  | "effect_source_missing"
  | "function_selection_missing"
  | "multiple_function_scope"
  | "positive_namespace_unmapped"
  | "provenance_missing"
  | "source_snapshot_stale"
  | "unsupported_capability_model_version"
  | "unsupported_direct_capability"

export type FunctionCapabilityDiagnostic = {
  function_key: string
  field_path: string
  code: FunctionCapabilityDiagnosticCode
  target: string
  provenance: string[]
}

export type FunctionCapabilityModelResult = {
  projection?: FunctionCapabilityModel
  diagnostics: FunctionCapabilityDiagnostic[]
}

export type FunctionGrantBoundaryContext = {
  function_key: string | string[]
  execution_authority: ExecutionAuthority
}

export type FunctionEffectSource = Omit<
  FunctionTransitiveEffect,
  "provenance_paths"
>
