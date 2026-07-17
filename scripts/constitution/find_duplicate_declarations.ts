import type {
  ConstitutionDeclaration,
  ConstitutionFindingInput,
} from "./types.ts"

export function findDuplicateDeclarations(
  ruleId: string,
  resourceKind: string,
  label: string,
  declarations: ConstitutionDeclaration[],
): ConstitutionFindingInput[] {
  const byValue = new Map<string, Set<string>>()
  for (const declaration of declarations) {
    const owners = byValue.get(declaration.value) ?? new Set<string>()
    owners.add(declaration.service_key)
    byValue.set(declaration.value, owners)
  }
  const findings: ConstitutionFindingInput[] = []
  for (const [value, ownerSet] of [...byValue].sort()) {
    const owners = [...ownerSet].sort()
    if (owners.length < 2) continue
    findings.push({
      rule_version: 1,
      rule_id: ruleId,
      subject: `${resourceKind}:${value}`,
      evidence: { owners: owners.join(","), resource: value },
      summary: `${label} ${value} is declared by ${owners.join(", ")}.`,
    })
  }
  return findings
}
