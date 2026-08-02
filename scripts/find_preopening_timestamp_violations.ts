import { readFile, readdir } from "node:fs/promises"
import { extname, join, relative, sep } from "node:path"
import { workspaceRoot } from "./architecture/paths.ts"
import { scanSqlPreopeningTimestamps } from "./scan_sql_preopening_timestamps.ts"
import { scanTypescriptPreopeningTimestamps } from "./scan_typescript_preopening_timestamps.ts"

const typescriptExtensions = new Set([
  ".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx",
])
const ignoredSegments = new Set([
  ".git", ".next", "coverage", "dist", "node_modules", "vendor",
])

export async function findPreopeningTimestampViolations(
  root = workspaceRoot,
): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const violations: string[] = []
  for (const entry of entries) {
    const path = join(entry.parentPath, entry.name)
    const normalized = relative(root, path).replaceAll(sep, "/")
    const segments = normalized.split("/")
    if (segments.some((segment) => segment.toLowerCase() === "docs" ||
      ignoredSegments.has(segment.toLowerCase()))) continue
    const extension = extname(entry.name).toLowerCase()
    if (!typescriptExtensions.has(extension) && extension !== ".sql") continue
    if (entry.isSymbolicLink()) {
      violations.push(`${normalized}: executable source symlink is prohibited`)
      continue
    }
    if (!entry.isFile()) continue
    const source = await readFile(path, "utf8")
    violations.push(...(extension === ".sql"
      ? scanSqlPreopeningTimestamps(source, normalized)
      : scanTypescriptPreopeningTimestamps(source, normalized)))
  }
  return violations.sort()
}
