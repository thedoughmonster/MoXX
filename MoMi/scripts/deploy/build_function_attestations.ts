import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { LoadedFunction } from "../architecture/types.ts"
import type { FunctionAttestation, HostedFunction } from "./types.ts"

export async function buildFunctionAttestations(
  functions: LoadedFunction[],
  hosted: HostedFunction[],
): Promise<FunctionAttestation[]> {
  const bySlug = new Map(hosted.map((item) => [item.slug, item]))
  const ordered = [...functions].sort((left, right) => left.slug.localeCompare(right.slug))
  return await Promise.all(ordered.map(async (item) => {
    const metadata = bySlug.get(item.slug)
    if (!metadata) throw new Error(`${item.slug}: hosted metadata is unavailable`)
    const manifest = await readFile(join(item.manifest_directory, "function.json"))
    return {
      ...metadata,
      function_json_sha256: createHash("sha256").update(manifest).digest("hex"),
    }
  }))
}
