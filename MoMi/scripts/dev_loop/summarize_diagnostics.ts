import { summarizeEvidence } from "./summarize_evidence.ts"
import type { DiagnosticSummary } from "./diagnostic_types.ts"

export function summarizeDiagnostics(source: string): {
  diagnostics: DiagnosticSummary[]
  additional: number
  capped: boolean
} {
  return summarizeEvidence([{ inline: source }])
}
