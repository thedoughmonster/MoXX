import { spawnSync } from "node:child_process"

import { fingerprintFinding } from "./fingerprint_finding.ts"

export function loadTargetBaselineFingerprints(): Set<string> {
  const path = "docs/service-constitution-debt-baseline.json"
  const result = spawnSync("git", ["show", `origin/dev:${path}`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout) {
    throw new Error("Unable to read the constitution baseline from origin/dev")
  }
  let document: unknown
  try {
    document = JSON.parse(result.stdout)
  } catch {
    throw new Error("The constitution baseline on origin/dev is not valid JSON")
  }
  if (
    typeof document !== "object" || document === null ||
    !("findings" in document) || !Array.isArray(document.findings)
  ) throw new Error("The constitution baseline on origin/dev has no findings array")
  const fingerprints = new Set<string>()
  for (const entry of document.findings) {
    if (
      typeof entry !== "object" || entry === null ||
      !("rule_id" in entry) || entry.rule_id !== "service_type_missing" ||
      !("subject" in entry) || typeof entry.subject !== "string"
    ) throw new Error("The constitution baseline on origin/dev has a malformed finding")
    const match = entry.subject.match(/^services\/([a-z][a-z0-9-]+)\/service\.json$/)
    if (!match) throw new Error("The constitution baseline on origin/dev has a malformed subject")
    const fingerprint = fingerprintFinding({
      rule_version: 1,
      rule_id: "service_type_missing",
      subject: entry.subject,
      evidence: { service_key: match[1] },
      summary: "Identity-only bootstrap conversion.",
    })
    if (fingerprints.has(fingerprint)) {
      throw new Error("The constitution baseline on origin/dev has duplicate findings")
    }
    fingerprints.add(fingerprint)
  }
  return fingerprints
}
