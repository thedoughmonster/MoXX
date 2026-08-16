import type { WorkspaceConfig } from "./architecture/types.ts"

export type SourceQualityPolicies = Pick<
  WorkspaceConfig["policies"],
  "max_handwritten_lines" | "hard_max_handwritten_lines"
>

export type SourceQualityDiagnostic = {
  code:
    | "SOURCE_HANDWRITTEN_LINE_LIMIT"
    | "SOURCE_MULTIPLE_TOP_LEVEL_FUNCTIONS"
    | "SOURCE_TYPESCRIPT_PARSE_FAILURE"
  path: string
  severity: "advisory" | "error"
  message: string
  repair_class: "BOUNDED_REFACTOR" | "SEMANTIC_REPAIR"
  actual?: number
  limit?: number
  line?: number
  column?: number
}
