import { decodeUtf8 } from "./decode_utf8.ts"
import { validateManifest } from "./validate_manifest.ts"
import type { PortableManifest } from "./manifest_types.ts"
import type { JsonObject } from "./types.ts"
import type { PackageTrust } from "./types.ts"

export function readManifest(path: string, bytes: Uint8Array, trust: PackageTrust): {
  path: string
  manifest: PortableManifest
  raw: JsonObject
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(decodeUtf8(bytes, "portable/manifest.json"))
  } catch (error) {
    throw new Error(`Cannot read portable/manifest.json: ${(error as Error).message}`)
  }
  return { path, manifest: validateManifest(parsed, trust), raw: parsed as JsonObject }
}
