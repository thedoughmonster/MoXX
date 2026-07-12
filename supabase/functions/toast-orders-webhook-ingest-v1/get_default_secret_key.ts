export function getDefaultSecretKey(
  serializedKeys: string | undefined,
): string | null {
  if (!serializedKeys) {
    return null
  }

  try {
    const keys = JSON.parse(serializedKeys) as Record<string, unknown>
    const defaultKey = keys?.default

    return typeof defaultKey === "string" && defaultKey.startsWith("sb_secret_")
      ? defaultKey
      : null
  } catch {
    return null
  }
}
