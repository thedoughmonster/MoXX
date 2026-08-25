import { extname } from "node:path"

const sourceExtensions = new Set([
  ".ts", ".md", ".json", ".sql", ".toml", ".yml", ".yaml",
])

export function isSourceQualityPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "")
  return sourceExtensions.has(extname(normalized)) &&
    !normalized.startsWith("node_modules/") && normalized !== "pnpm-lock.yaml"
}
