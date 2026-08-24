import type { SourceQualityPolicies } from "../source_quality_types.ts"
import type { RepositoryDiagnosticV1 } from "../diagnostics/types.ts"
import type { FixId } from "../momi_fix/types.ts"

export type HookEvent = {
  cwd?: unknown
  hook_event_name?: unknown
  session_id?: unknown
  tool_input?: { command?: unknown }
  tool_name?: unknown
  turn_id?: unknown
}

export type PostWriteDiagnostic = {
  code: string
  path: string
  severity: "advisory" | "error"
  evidence: Record<string, unknown>
  repair_class: "AUTO_FIX" | "BOUNDED_REFACTOR" | "SEMANTIC_REPAIR"
  repository_diagnostic?: RepositoryDiagnosticV1
}

export type CanonicalGenerator = FixId
export type CanonicalArtifactGenerator = Extract<
  CanonicalGenerator,
  "catalog" | "quality"
>

export type CanonicalGeneratorIdentity = {
  kind: CanonicalGenerator
  script: string
  command: string
  path: string
  validation_command: string
}

export type GeneratorResult = {
  changed: boolean
  command: string
  kind: CanonicalGenerator
  path: string
}

export type PostWriteOptions = {
  policies: SourceQualityPolicies
  root: string
  runGenerator?(
    root: string,
    kind: CanonicalGenerator,
  ): Promise<GeneratorResult>
}
