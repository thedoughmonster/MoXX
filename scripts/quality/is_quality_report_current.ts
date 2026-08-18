export function isQualityReportCurrent(actual: string, expected: string): boolean {
  return actual.replaceAll("\r\n", "\n") === expected.replaceAll("\r\n", "\n")
}
