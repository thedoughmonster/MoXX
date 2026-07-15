export function selectSafeHeaders(headers: Headers): Record<string, string> {
  const allowed = new Set([
    "accept",
    "content-type",
    "date",
    "link",
    "retry-after",
    "toast-next-page-token",
    "toast-restaurant-external-id",
    "x-correlation-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "x-request-id",
    "x-toast-ratelimit-remaining",
    "x-toast-ratelimit-reset",
    "x-trace-id",
  ]);
  const safe: Record<string, string> = {};
  for (const [name, value] of headers.entries()) {
    const normalized = name.toLowerCase();
    if (allowed.has(normalized)) safe[normalized] = value;
  }
  return safe;
}
