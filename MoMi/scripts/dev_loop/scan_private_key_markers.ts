import type { EvidenceRedactionState } from "./redact_evidence_line.ts"

const marker = /-----((?:BEGIN)|(?:END)) (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/giu

export function scanPrivateKeyMarkers(
  value: string,
  state: EvidenceRedactionState,
): void {
  for (const match of value.matchAll(marker)) {
    state.private_key = match[1]?.toUpperCase() === "BEGIN"
  }
}
