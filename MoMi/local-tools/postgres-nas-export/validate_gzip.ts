import { createReadStream } from "node:fs"
import { lstat } from "node:fs/promises"
import { Writable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createGunzip } from "node:zlib"

export async function validateGzip(path: string): Promise<void> {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1) {
    throw new Error("Portable gzip export path is unsafe or empty")
  }
  let uncompressedBytes = 0
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      uncompressedBytes += chunk.length
      callback()
    },
  })
  await pipeline(createReadStream(path), createGunzip(), sink)
  if (uncompressedBytes < 1) throw new Error("Portable gzip export expands to an empty file")
}
