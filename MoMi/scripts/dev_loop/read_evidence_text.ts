import { existsSync, readFileSync } from "node:fs"

export function readEvidenceText(inline: string | undefined, path: string | undefined): string {
  if (inline) return inline
  if (!path || !existsSync(path)) return ""
  return readFileSync(path, "utf8")
}
