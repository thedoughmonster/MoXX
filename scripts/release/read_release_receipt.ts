import { readFileSync } from "node:fs"

import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { hashText } from "../dev_loop/hash_text.ts"
import type { ReleaseReceipt } from "./types.ts"

export function readReleaseReceipt(path: string): ReleaseReceipt {
  const receipt = JSON.parse(readFileSync(path, "utf8")) as ReleaseReceipt
  if (
    receipt.schema_version !== 1 || receipt.kind !== "release" ||
    receipt.environment !== "dev" ||
    !/^[0-9a-f]{40}$/.test(receipt.head_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.head_tree ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.plan_sha256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.validation_receipt_sha256 ?? "") ||
    hashText(canonicalJson(receipt.plan)) !== receipt.plan_sha256 ||
    receipt.plan.head.sha !== receipt.head_sha ||
    receipt.plan.head.tree !== receipt.head_tree ||
    receipt.plan.diff_sha256 !== receipt.diff_sha256 ||
    receipt.plan.impact_sha256 !== receipt.impact_sha256 ||
    receipt.plan.impact.release.services.join(",") !== receipt.services.join(",") ||
    receipt.plan.impact.release.functions.join(",") !== receipt.functions.join(",") ||
    receipt.validation.required_job !== "validate-final" ||
    receipt.validation.counts.failed !== 0 ||
    receipt.validation.identities.head_tree !== receipt.head_tree ||
    receipt.validation.identities.diff_sha256 !== receipt.diff_sha256 ||
    receipt.validation.identities.impact_sha256 !== receipt.impact_sha256
  ) throw new Error("Invalid development release receipt")
  return receipt
}
