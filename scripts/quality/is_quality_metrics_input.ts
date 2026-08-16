import { extname } from "node:path"

const extensions = new Set([".ts", ".md", ".json", ".sql", ".toml", ".yml", ".yaml"])
const ignoredPrefixes = [
  ".momi/",
  "node_modules/",
  "supabase/.branches/",
  "supabase/.temp/",
]

export function isQualityMetricsInput(path: string): boolean {
  return extensions.has(extname(path)) && path !== "pnpm-lock.yaml" &&
    path !== "docs/quality-metrics.json" &&
    !ignoredPrefixes.some((prefix) => path.startsWith(prefix))
}
