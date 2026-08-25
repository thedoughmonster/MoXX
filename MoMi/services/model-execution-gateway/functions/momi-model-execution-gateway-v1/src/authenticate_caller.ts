import type { CallerKey } from "./types.ts"

const callers: [CallerKey, string][] = [
  ["communications-gateway", "MOMI_MODEL_GATEWAY_COMMUNICATIONS_SECRET"],
  ["communications-evaluation", "MOMI_MODEL_GATEWAY_EVALUATION_SECRET"],
  ["github-issue-triage", "MOMI_MODEL_GATEWAY_TRIAGE_SECRET"],
]

export async function authenticateCaller(
  authorization: string | null,
  readSecret: (key: string) => string | undefined = Deno.env.get,
): Promise<CallerKey | null> {
  if (!authorization?.startsWith("Bearer ")) return null
  const presented = new TextEncoder().encode(authorization.slice(7))
  for (const [caller, secretName] of callers) {
    const expectedValue = readSecret(secretName)?.trim()
    if (!expectedValue) continue
    const expected = new TextEncoder().encode(expectedValue)
    if (presented.length !== expected.length) continue
    const [left, right] = await Promise.all([
      crypto.subtle.digest("SHA-256", presented),
      crypto.subtle.digest("SHA-256", expected),
    ])
    const a = new Uint8Array(left)
    const b = new Uint8Array(right)
    let difference = 0
    for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index]
    if (difference === 0) return caller
  }
  return null
}
