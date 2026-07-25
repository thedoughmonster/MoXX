export function isCompletionAuthorized(request: Request): boolean {
  const expected = Deno.env.get("MOMI_MODEL_COMPLETION_CALLBACK_SECRET")?.trim()
  const header = request.headers.get("authorization")
  if (!expected || !header?.startsWith("Bearer ")) return false
  const actual = header.slice(7)
  if (actual.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index)
  }
  return mismatch === 0
}
