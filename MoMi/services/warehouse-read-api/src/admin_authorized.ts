export async function adminAuthorized(
  authorization: string | null,
  expected: string,
): Promise<boolean> {
  if (!authorization?.startsWith("Bearer ") || authorization.length > 256 ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(expected)) return false
  const encoder = new TextEncoder()
  const [provided, configured] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(authorization.slice(7))),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ])
  const left = new Uint8Array(provided)
  const right = new Uint8Array(configured)
  let difference = 0
  for (let index = 0; index < left.length; index++) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}
