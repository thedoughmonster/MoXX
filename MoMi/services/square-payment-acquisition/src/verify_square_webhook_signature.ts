export async function verifySquareWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string,
  signatureKey: string,
  notificationUrl: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureKey || !notificationUrl) return false
  let signature: Uint8Array
  try {
    const decoded = atob(signatureHeader)
    signature = new Uint8Array(decoded.length)
    for (let index = 0; index < decoded.length; index += 1) {
      signature[index] = decoded.charCodeAt(index)
    }
  } catch {
    return false
  }
  const urlBytes = new TextEncoder().encode(notificationUrl)
  const signedBytes = new Uint8Array(urlBytes.length + rawBody.length)
  signedBytes.set(urlBytes)
  signedBytes.set(rawBody, urlBytes.length)
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(signatureKey),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    )
    return crypto.subtle.verify("HMAC", key, signature.buffer as ArrayBuffer, signedBytes)
  } catch {
    return false
  }
}
