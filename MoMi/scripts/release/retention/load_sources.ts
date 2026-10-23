import { readFileSync, readdirSync } from "node:fs"
import { basename, join, relative } from "node:path"
import { canonicalJson } from "../../dev_loop/canonical_json.ts"
import { hashText } from "../../dev_loop/hash_text.ts"
import { retentionMigrations } from "./policy.ts"
import type { RetentionApproval } from "./types.ts"

export function loadRetentionSources(root: string, approval: RetentionApproval) {
  const sources = approval.migrations.map((version) => {
    const pin = retentionMigrations[version as keyof typeof retentionMigrations]
    if (!pin) throw new Error("Unapproved retention migration")
    const sql = readFileSync(join(root, pin.file), "utf8")
      .replaceAll("\r\n", "\n")
    if (hashText(sql) !== pin.sha256) throw new Error(`Changed retention SQL: ${version}`)
    const outer = sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "")
      .replace(/'(?:''|[^'])*'/g, "''").replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "")
    if (/(^|;)\s*(begin|commit|rollback|savepoint|end|start\s+transaction)\b/i.test(outer)) {
      throw new Error("Retention source contains transaction control")
    }
    return { version, name: basename(pin.file).slice(15, -4), sql }
  })
  const directories = ["services/cron-history-governance",
    "supabase/functions/momi-cron-history-governor-v1"]
  const payload: { path: string; sha256: string }[] = []
  for (const directory of directories) {
    const base = join(root, directory)
    for (const entry of readdirSync(base, { recursive: true, withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("Retention payload cannot contain symlinks")
      if (!entry.isFile()) continue
      const path = join(entry.parentPath, entry.name)
      payload.push({ path: relative(root, path).replaceAll("\\", "/"),
        sha256: hashText(readFileSync(path, "utf8").replaceAll("\r\n", "\n")) })
    }
  }
  const sourceDigest = hashText(canonicalJson(payload.sort((a, b) => a.path.localeCompare(b.path))))
  if (sourceDigest !== approval.function_source_sha256) throw new Error("Governor payload changed")
  return { sources, sourceDigest }
}
