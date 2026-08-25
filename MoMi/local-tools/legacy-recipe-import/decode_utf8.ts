const decoder = new TextDecoder("utf-8", { fatal: true })

export function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return decoder.decode(bytes)
  } catch {
    throw new Error(`${label} is not valid UTF-8`)
  }
}
