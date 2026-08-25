export function selectSafeHeaders(headers: Headers): Record<string, string> {
  const allowed = new Set([
    "content-type",
    "date",
    "retry-after",
    "x-correlation-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "x-request-id",
    "x-trace-id",
  ])
  const safeHeaders: Record<string, string> = {}

  for (const [name, value] of headers.entries()) {
    if (allowed.has(name.toLowerCase())) {
      safeHeaders[name] = value
    }
  }

  return safeHeaders
}
