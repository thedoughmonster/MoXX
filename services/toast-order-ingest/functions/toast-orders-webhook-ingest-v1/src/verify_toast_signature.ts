export async function verifyToastSignature(
  rawBody: string,
  timestamp: string,
  providedSignature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    )
    const signature = Uint8Array.from(
      atob(providedSignature),
      (character) => character.charCodeAt(0),
    )

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(rawBody + timestamp),
    )
  } catch {
    return false
  }
}
