export async function digestEvidenceIdentity(values: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(values))
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("")
}
