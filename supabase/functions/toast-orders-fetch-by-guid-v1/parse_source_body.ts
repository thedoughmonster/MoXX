export function parseSourceBody(rawBody: string): unknown {
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}
