import { readEvidenceLines } from "./read_evidence_lines.ts"
import { findEvidenceLocations } from "./find_evidence_locations.ts"
import { formatEvidenceLocation } from "./format_evidence_location.ts"
import { hashText } from "./hash_text.ts"
import type { DiagnosticSummary } from "./diagnostic_types.ts"

const chatter = /^(?:TAP version|[✔✓ℹ﹣]|ok\s+\d|(?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\s+\d|Progress:|Packages:|[+.#=─━-]{8,})/u
const stack = /^(?:at\s|node:internal\/|\^+$)/u
const additionalLimit = 4096
const locationLimit = 8192

export function summarizeEvidence(inputs: Array<{
  inline?: string
  path?: string
}>): { diagnostics: DiagnosticSummary[]; additional: number; capped: boolean } {
  const groups = new Map<string, DiagnosticSummary>()
  const locationGroups = new Map<DiagnosticSummary, {
    hashes: Set<string>
    examples: Set<string>
  }>()
  const additional = new Set<string>()
  let capped = false
  for (const input of inputs) {
    for (const rawLine of readEvidenceLines(input.inline, input.path)) {
      const line = rawLine.trim().replace(/^#\s*/u, "")
      if (line === "✖ failing tests:") {
        groups.clear()
        locationGroups.clear()
        additional.clear()
        continue
      }
      if (!line || chatter.test(line) || stack.test(line)) continue
      const evidence = findEvidenceLocations(line)
      const locations = evidence.locations
      const normalized = evidence.normalized
        .replace(/\b\d+(?:\.\d+)?ms\b/gu, "<duration>")
        .replace(/\s+/gu, " ").trim()
      if (!normalized) continue
      const key = normalized.toLowerCase()
      let diagnostic = groups.get(key)
      if (diagnostic) diagnostic.occurrences += 1
      else {
        const identity = `diagnostic-${hashText(key).slice(0, 12)}`
        if (groups.size >= 8) {
          if (additional.has(identity)) continue
          if (additional.size < additionalLimit) additional.add(identity)
          else capped = true
          continue
        }
        diagnostic = { identity, message: line.slice(0, 300), locations: [],
          location_count: 0, occurrences: 1 }
        groups.set(key, diagnostic)
        locationGroups.set(diagnostic, { hashes: new Set(), examples: new Set() })
      }
      const retained = locationGroups.get(diagnostic)
      for (const item of locations) {
        const hash = hashText(item)
        if (retained?.hashes.has(hash)) continue
        if ((retained?.hashes.size ?? 0) >= locationLimit) {
          diagnostic.location_count_capped = true
          continue
        }
        retained?.hashes.add(hash)
        if ((retained?.examples.size ?? 0) < 12) {
          retained?.examples.add(formatEvidenceLocation(item, hash))
        }
      }
    }
  }
  const diagnostics = [...groups.values()].map((item) => {
    const retained = locationGroups.get(item)
    return { ...item, location_count: retained?.hashes.size ?? 0,
      locations: [...(retained?.examples ?? [])].sort() }
  })
  return { diagnostics, additional: additional.size, capped }
}
