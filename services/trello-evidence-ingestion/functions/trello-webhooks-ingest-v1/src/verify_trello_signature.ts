export async function verifyTrelloSignature(
  rawBody: string,
  callbackUrl: string,
  providedSignature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-1" },
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
      encoder.encode(rawBody + callbackUrl),
    )
  } catch {
    return false
  }
}
