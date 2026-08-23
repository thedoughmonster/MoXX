export type DiagnosticSummary = {
  identity: string
  message: string
  locations: string[]
  location_count: number
  location_count_capped?: true
  occurrences: number
}
