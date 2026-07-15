export async function signToastBody(
  rawBody: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody + timestamp),
  )
  const binary = Array.from(
    new Uint8Array(signature),
    (byte) => String.fromCharCode(byte),
  ).join("")
  return btoa(binary)
}
