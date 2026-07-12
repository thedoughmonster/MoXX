export function isSecretKeyAuthorization(
  apiKey: string | null,
  serializedKeys: string | undefined,
): boolean {
  if (!apiKey || !serializedKeys) {
    return false
  }

  try {
    const keys = JSON.parse(serializedKeys) as Record<string, unknown>
    const expectedKey = keys.default

    return typeof expectedKey === "string" &&
      expectedKey.startsWith("sb_secret_") && apiKey === expectedKey
  } catch {
    return false
  }
}
