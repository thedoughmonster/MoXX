const maximumBytes = 262_144

export async function readRawBody(request: Request): Promise<Uint8Array> {
  const length = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(length) || length < 0 || length > maximumBytes) {
    throw new Error("payload_too_large")
  }
  const raw = new Uint8Array(await request.arrayBuffer())
  if (raw.byteLength < 1 || raw.byteLength > maximumBytes) {
    throw new Error("payload_too_large")
  }
  return raw
}
