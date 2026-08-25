import { spawnSync } from "node:child_process"

import { fingerprintFinding } from "./fingerprint_finding.ts"
import type { ConstitutionFinding } from "./types.ts"
import { accessBootstrapFingerprints } from
  "./access_bootstrap_fingerprints.ts"
import { productPathAtRef } from "../git_product_layout.ts"

const baselinePath = "docs/service-access-debt-baseline.json"
const bootstrapBase = "fafe25dfac85e2d119dcb641821e59913558070d"
export function loadTargetAccessBaselineFingerprints(
  ref = process.env.MOMI_DEV_REF ?? "origin/dev",
): Set<string> {
  if (ref !== "origin/dev" && !/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error("MOMI_DEV_REF must be origin/dev or a full commit SHA")
  }
  const result = spawnSync(
    "git", ["show", `${ref}:${productPathAtRef(ref, baselinePath)}`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout) {
    const target = spawnSync("git", ["rev-parse", ref], {
      encoding: "utf8",
    })
    if (target.status !== 0 || target.stdout.trim() !== bootstrapBase) {
      throw new Error("Unable to read the access baseline from the trusted development ref")
    }
    return new Set(accessBootstrapFingerprints)
  }
  let document: unknown
  try {
    document = JSON.parse(result.stdout)
  } catch {
    throw new Error("The access baseline on the trusted development ref is not valid JSON")
  }
  if (
    typeof document !== "object" || document === null ||
    !("findings" in document) || !Array.isArray(document.findings)
  ) throw new Error("The trusted access baseline has no findings array")
  const fingerprints = new Set<string>()
  for (const entry of document.findings as ConstitutionFinding[]) {
    const fingerprint = fingerprintFinding(entry)
    if (fingerprints.has(fingerprint)) {
      throw new Error("The trusted access baseline has duplicate findings")
    }
    if (!accessBootstrapFingerprints.has(fingerprint)) {
      throw new Error("The trusted access baseline contains post-bootstrap debt")
    }
    fingerprints.add(fingerprint)
  }
  return fingerprints
}
