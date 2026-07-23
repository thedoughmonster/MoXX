import { visibleAlias } from "./types.ts"

export function failedProviderResponse(id: string, status: string, code?: string) {
  const deadline = code === "provider_background_deadline_exceeded"
  const ambiguous = status === "paid_ambiguous"
  return { status: deadline ? 504 : 502, body: {
    id,
    object: "momi.execution",
    model: visibleAlias,
    status,
    error: deadline ? "maximum_analysis_deadline_exceeded"
      : ambiguous ? "provider_outcome_ambiguous" : "provider_request_failed",
    message: deadline
      ? "Maximum analysis did not finish within your configured deadline and was not retried."
      : ambiguous
      ? "The provider outcome is uncertain, so this request was not retried."
      : "The provider could not complete this request, and it was not retried.",
  } }
}
