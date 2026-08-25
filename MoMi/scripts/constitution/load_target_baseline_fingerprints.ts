import { spawnSync } from "node:child_process"

import { fingerprintFinding } from "./fingerprint_finding.ts"
import { productPathAtRef } from "../git_product_layout.ts"

export function loadTargetBaselineFingerprints(): Set<string> {
  const path = "docs/service-constitution-debt-baseline.json"
  const ref = process.env.MOMI_DEV_REF ?? "origin/dev"
  if (ref !== "origin/dev" && !/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error("MOMI_DEV_REF must be origin/dev or a full commit SHA")
  }
  const result = spawnSync("git", ["show", `${ref}:${productPathAtRef(ref, path)}`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout) {
    throw new Error("Unable to read the constitution baseline from the trusted development ref")
  }
  let document: unknown
  try {
    document = JSON.parse(result.stdout)
  } catch {
    throw new Error("The trusted constitution baseline is not valid JSON")
  }
  if (
    typeof document !== "object" || document === null ||
    !("findings" in document) || !Array.isArray(document.findings)
  ) throw new Error("The trusted constitution baseline has no findings array")
  const fingerprints = new Set<string>()
  for (const entry of document.findings) {
    if (
      typeof entry !== "object" || entry === null ||
      !("rule_id" in entry) || entry.rule_id !== "service_type_missing" ||
      !("subject" in entry) || typeof entry.subject !== "string"
    ) throw new Error("The trusted constitution baseline has a malformed finding")
    const match = entry.subject.match(/^services\/([a-z][a-z0-9-]+)\/service\.json$/)
    if (!match) throw new Error("The trusted constitution baseline has a malformed subject")
    const fingerprint = fingerprintFinding({
      rule_version: 1,
      rule_id: "service_type_missing",
      subject: entry.subject,
      evidence: { service_key: match[1] },
      summary: "Identity-only bootstrap conversion.",
    })
    if (fingerprints.has(fingerprint)) {
      throw new Error("The trusted constitution baseline has duplicate findings")
    }
    fingerprints.add(fingerprint)
  }
  if (fingerprints.size > 0) {
    throw new Error("The trusted constitution baseline cannot reintroduce declaration debt")
  }
  return fingerprints
}
