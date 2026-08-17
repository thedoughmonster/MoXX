import Ajv2020 from "ajv/dist/2020.js"
import { join } from "node:path"

import { readJson } from "./read_json.ts"

type DebtBaseline = {
  findings: Array<{
    rule_id: string
    evidence: Record<string, string>
  }>
}

export async function loadExecutionAuthorityDebtTargets(
  root: string,
): Promise<string[]> {
  const schema = await readJson<object>(join(
    root, "schemas", "service-access-debt-baseline-v1.schema.json",
  ))
  const value = await readJson<unknown>(join(
    root, "docs", "service-access-debt-baseline.json",
  ))
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
  if (!validate(value)) {
    throw new Error(
      `Invalid service access debt baseline: ${JSON.stringify(validate.errors)}`,
    )
  }
  const targets: string[] = []
  for (const finding of (value as DebtBaseline).findings) {
    const key = finding.rule_id === "direct_private_relation_access"
      ? "relation"
      : finding.rule_id === "direct_private_routine_call" ? "routine" : undefined
    if (key && finding.evidence[key]) targets.push(finding.evidence[key])
  }
  return [...new Set(targets)].sort((left, right) =>
    left.localeCompare(right))
}
