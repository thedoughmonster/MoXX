export function analysisDatabaseError(error: unknown): string {
  const value = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown }
    : {}
  const code = typeof value.code === "string" ? value.code : ""
  const message = typeof value.message === "string" ? value.message : ""
  if (message.includes("analysis_query_rejected")) {
    return "analysis_query_not_allowed"
  }
  if (message.includes("analysis_result_too_large")) {
    return "analysis_result_too_large"
  }
  if (code === "57014") return "analysis_query_timeout"
  if (["42601"].includes(code)) return "analysis_query_invalid"
  if (["42P01", "42703", "42883", "42P10"].includes(code)) {
    return "analysis_query_schema_mismatch"
  }
  if (code === "42501") return "analysis_query_permission_denied"
  if (code.startsWith("22")) return "analysis_query_data_error"
  return "analysis_query_database_error"
}
