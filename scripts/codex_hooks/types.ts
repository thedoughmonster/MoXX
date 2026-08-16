import type { SourceQualityPolicies } from "../source_quality_types.ts"

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
}

export type CanonicalGenerator = "catalog" | "quality"

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
