import { readFileSync } from "node:fs"

import type { ValidationReceipt } from "../dev_loop/types.ts"
import { validateValidationReceipt } from "../dev_loop/validate_validation_receipt.ts"

export function readValidationReceipt(path: string): ValidationReceipt {
  const receipt = validateValidationReceipt(JSON.parse(readFileSync(path, "utf8")))
  if (receipt.counts.hard_failed !== 0) {
    throw new Error("Authoritative validation has hard failures")
  }
  return receipt
}
