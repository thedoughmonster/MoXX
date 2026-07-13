export function selectSafeSlackHeaders(
  headers: Headers,
): Record<string, string> {
  const allowed = new Set([
    "content-type",
    "date",
    "retry-after",
    "x-slack-req-id",
  ])
  const safeHeaders: Record<string, string> = {}

  for (const [name, value] of headers.entries()) {
    if (allowed.has(name.toLowerCase())) {
      safeHeaders[name.toLowerCase()] = value
    }
  }

  return safeHeaders
}
