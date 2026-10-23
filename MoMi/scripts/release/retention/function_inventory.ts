import { canonicalJson } from "../../dev_loop/canonical_json.ts"
import { hashText } from "../../dev_loop/hash_text.ts"
import { retentionFunctionSlug } from "./policy.ts"

export function retentionFunctionInventory(source: string) {
  const parsed: unknown = JSON.parse(source)
  const entries = Array.isArray(parsed) ? parsed
    : parsed && typeof parsed === "object" && "functions" in parsed ? parsed.functions : null
  if (!Array.isArray(entries)) throw new Error("Invalid hosted function inventory")
  const rows = entries.map((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.slug !== "string" ||
      typeof entry.version !== "number" || typeof entry.ezbr_sha256 !== "string") {
      throw new Error("Unverifiable hosted function inventory")
    }
    return { slug: entry.slug as string, version: entry.version as number,
      ezbr_sha256: entry.ezbr_sha256 as string, status: entry.status,
      verify_jwt: entry.verify_jwt }
  }).sort((a, b) => a.slug.localeCompare(b.slug))
  if (new Set(rows.map((entry) => entry.slug)).size !== rows.length) {
    throw new Error("Duplicate hosted function identity")
  }
  return { rows, sha256: hashText(canonicalJson(rows)),
    unrelated: canonicalJson(rows.filter((entry) => entry.slug !== retentionFunctionSlug)) }
}
