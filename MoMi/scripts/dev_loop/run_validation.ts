import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { buildCompactReceipt } from "./build_compact_receipt.ts"
import { canonicalJson } from "./canonical_json.ts"
import { executeChecks } from "./execute_checks.ts"
import { renderAgentValidationSummary } from "./render_agent_validation_summary.ts"
import type { CheckCommand, CompactReceipt, ReceiptInput } from "./types.ts"
import type { CheckExecutionBinding } from "./final_validation_types.ts"

export type ValidationRun = Omit<ReceiptInput, "commands"> & {
  checks: CheckCommand[]
  receipt_path: string
  receipt_fields?: Record<string, unknown>
  execution_binding?: CheckExecutionBinding
  summary_label?: string
}

export function runValidation(input: ValidationRun): CompactReceipt {
  rmSync(input.receipt_path, { force: true })
  const compact = buildCompactReceipt({
    ...input,
    commands: executeChecks(input.checks, input.execution_binding),
  })
  input.execution_binding?.assert_invariants?.()
  const receipt = { ...compact, ...input.receipt_fields }
  mkdirSync(dirname(input.receipt_path), { recursive: true })
  writeFileSync(input.receipt_path, `${canonicalJson(receipt)}\n`)
  process.stdout.write(renderAgentValidationSummary(
    compact,
    input.receipt_path,
    input.summary_label,
  ))
  return compact
}
