export async function digestRawBody(rawBody: Uint8Array): Promise<string> {
  const bytes = Uint8Array.from(rawBody)
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0")).join("")
}
