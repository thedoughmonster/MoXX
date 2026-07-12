export function isInternalKeyAuthorization(
  providedKey: string | null,
  expectedKey: string | undefined,
): boolean {
  if (!providedKey || !expectedKey || expectedKey.length < 32) {
    return false
  }

  return providedKey === expectedKey
}
