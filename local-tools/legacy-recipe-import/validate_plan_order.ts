import { basename } from "node:path"

import type { PlanOutput, SqlPlanFile } from "./types.ts"

export function validatePlanOrder(
  output: PlanOutput,
  phase: SqlPlanFile["phase"],
): SqlPlanFile[] {
  const all = output.plan.files
  const names = new Set<string>()
  let previous = ""
  for (const file of all) {
    if (basename(file.file) !== file.file || names.has(file.file) ||
      (previous !== "" && file.file <= previous)) {
      throw new Error("SQL plan files are not uniquely ordered")
    }
    names.add(file.file)
    previous = file.file
  }
  const selected = all.filter((file) => file.phase === phase)
  if (selected.length === 0) throw new Error(`SQL plan has no ${phase} files`)
  return selected
}
