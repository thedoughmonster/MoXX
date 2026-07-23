export function classifyHandwrittenLineCount(
  lineCount: number,
  softLimit: number,
  hardLimit: number,
): "valid" | "warning" | "violation" {
  if (lineCount > hardLimit) return "violation"
  if (lineCount > softLimit) return "warning"
  return "valid"
}
