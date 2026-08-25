import { readFileSync } from "node:fs"

import type { ValidationReceipt } from "../dev_loop/types.ts"

export function readValidationReceipt(path: string): ValidationReceipt {
  const receipt = JSON.parse(readFileSync(path, "utf8")) as ValidationReceipt
  if (
    receipt.schema_version !== 1 ||
    receipt.kind !== "validation" ||
    receipt.required_job !== "validate-final" ||
    (receipt.gate !== "full" && receipt.gate !== "path_scoped") ||
    receipt.counts?.failed !== 0 ||
    !/^[1-9][0-9]*$/.test(receipt.run_log?.run_id ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.base_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.head_sha ?? "") ||
    !/^[0-9a-f]{40}$/.test(receipt.identities?.head_tree ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.identities?.diff_sha256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.identities?.impact_sha256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(receipt.identities?.plan_sha256 ?? "")
  ) throw new Error("Invalid authoritative validation receipt")
  return receipt
}
