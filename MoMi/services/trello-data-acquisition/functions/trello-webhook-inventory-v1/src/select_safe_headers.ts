export function selectSafeHeaders(headers: Headers): Record<string, string> {
  const safe: Record<string, string> = {}
  for (const name of ["content-type", "x-trello-version", "x-request-id"]) {
    const value = headers.get(name)
    if (value) safe[name] = value
  }
  return safe
}
