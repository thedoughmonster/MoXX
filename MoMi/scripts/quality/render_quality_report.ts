import type { QualityMetrics } from "./types.ts"

export function renderQualityReport(metrics: QualityMetrics): string {
  return `${JSON.stringify({
    generated: true,
    purpose: "Repository-wide trend signals; compare this file through Git history.",
    metrics,
  }, null, 2)}\n`
}
