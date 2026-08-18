const metricKeys = [
  "branch_complexity_points",
  "handwritten_files",
  "handwritten_lines",
  "import_declarations",
  "top_level_functions",
  "typescript_files",
]

export function parseQualityReport(source: string): void {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error("Quality trend report must be valid JSON")
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Quality trend report must be an object")
  }
  const report = value as Record<string, unknown>
  if (Object.keys(report).sort().join(",") !== "generated,metrics,purpose") {
    throw new Error("Quality trend report fields are malformed")
  }
  if (
    report.generated !== true ||
    report.purpose !==
      "Repository-wide trend signals; compare this file through Git history."
  ) throw new Error("Quality trend report identity is malformed")
  if (!report.metrics || typeof report.metrics !== "object" ||
    Array.isArray(report.metrics)) {
    throw new Error("Quality trend report metrics must be an object")
  }
  const metrics = report.metrics as Record<string, unknown>
  if (Object.keys(metrics).sort().join(",") !== metricKeys.join(",")) {
    throw new Error("Quality trend report metric fields are malformed")
  }
  if (metricKeys.some((key) =>
    !Number.isSafeInteger(metrics[key]) || Number(metrics[key]) < 0
  )) throw new Error("Quality trend report metrics must be nonnegative integers")
}
