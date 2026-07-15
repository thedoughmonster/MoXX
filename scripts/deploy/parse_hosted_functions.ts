import type { HostedFunction } from "./types.ts"

export function parseHostedFunctions(output: string): HostedFunction[] {
  const parsed: unknown = JSON.parse(output)
  if (!Array.isArray(parsed)) {
    throw new Error("Supabase function inventory must be a JSON array")
  }
  const functions = parsed.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Supabase function inventory row ${index} must be an object`)
    }
    const value = row as Record<string, unknown>
    if (typeof value.slug !== "string" || value.slug.length === 0) {
      throw new Error(`Supabase function inventory row ${index} has no slug`)
    }
    return {
      slug: value.slug,
      status: typeof value.status === "string" ? value.status : null,
      version: typeof value.version === "number" ? value.version : null,
      verify_jwt: typeof value.verify_jwt === "boolean" ? value.verify_jwt : null,
      entrypoint_path: typeof value.entrypoint_path === "string"
        ? value.entrypoint_path
        : null,
      ezbr_sha256: typeof value.ezbr_sha256 === "string" ? value.ezbr_sha256 : null,
    }
  })
  return functions.sort((left, right) => left.slug.localeCompare(right.slug))
}
