import type { CheckEnforcement } from "../dev_loop/check_types.ts"

export type DiagnosticFingerprintValueV1 = string | number | boolean

export type DiagnosticFingerprintV1 = {
  group: Record<string, DiagnosticFingerprintValueV1>
  instance: Record<string, DiagnosticFingerprintValueV1>
}

export type DiagnosticLocationV1 =
  | { path: string; line?: never; column?: never }
  | { path: string; line: number; column?: number }

export type DiagnosticRepairV1 =
  | { kind: "command"; command: string }
  | { kind: "none" }

export type RepositoryDiagnosticV1 = {
  schema_version: 1
  rule_id: string
  enforcement: CheckEnforcement
  location?: DiagnosticLocationV1
  violated_rule: string
  rationale?: string
  expected: string
  repair: DiagnosticRepairV1
  validation_command: string
  fingerprint: DiagnosticFingerprintV1
}
