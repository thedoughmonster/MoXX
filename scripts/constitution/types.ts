export type FindingEvidence = Record<string, string>

export type ConstitutionFindingInput = {
  rule_version: 1
  rule_id: string
  subject: string
  evidence: FindingEvidence
  summary: string
}

export type ConstitutionFinding = ConstitutionFindingInput & {
  fingerprint: string
}

export type ConstitutionDeclaration = {
  service_key: string
  value: string
}

export type ConstitutionBaseline = {
  $schema: string
  schema_version: 1
  generated_from: string
  notes: string[]
  findings: ConstitutionFinding[]
}
