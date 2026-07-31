export async function readJsonBody(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(length) || length < 0 || length > 8192) {
    throw new Error("invalid_body_size")
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > 8192) throw new Error("invalid_body_size")
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
}
