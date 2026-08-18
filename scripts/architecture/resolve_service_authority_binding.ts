import Ajv2020 from "ajv/dist/2020.js"

import { findServiceAuthorityBindingDebtDiagnostics } from
  "./find_service_authority_binding_debt_diagnostics.ts"
import { findServiceAuthorityBindingExecutionDiagnostics } from
  "./find_service_authority_binding_execution_diagnostics.ts"
import { findServiceAuthorityBindingIdentityDiagnostics } from
  "./find_service_authority_binding_identity_diagnostics.ts"
import { findServiceAuthorityBindingManifestDiagnostics } from
  "./find_service_authority_binding_manifest_diagnostics.ts"
import type {
  ServiceAuthorityBinding,
  ServiceAuthorityBindingContext,
  ServiceAuthorityBindingDiagnostic,
  ServiceAuthorityBindingResolution,
} from "./service_authority_binding_types.ts"
import { sortServiceAuthorityBindingDiagnostics } from
  "./sort_service_authority_binding_diagnostics.ts"

export async function resolveServiceAuthorityBinding(
  value: unknown,
  schema: object,
  context: ServiceAuthorityBindingContext,
): Promise<ServiceAuthorityBindingResolution> {
  const raw = value as Partial<ServiceAuthorityBinding>
  const service = typeof raw?.service === "string" ? raw.service : "<unknown>"
  const diagnostics: ServiceAuthorityBindingDiagnostic[] = []
  const report = (json_pointer: string, code: string, target: string) => {
    diagnostics.push({ service, layer: "binding", source_path: "",
      json_pointer, code, target, message: `${code}: ${target}` })
  }
  if (raw?.schema_version !== "service-authority-binding/v1") {
    report("/schema_version", "unknown_version", String(raw?.schema_version))
    return { diagnostics: sortServiceAuthorityBindingDiagnostics(diagnostics) }
  }
  const copiedKeys = new Set([
    "body", "database", "evidence", "findings", "owned_dataset",
    "positive_authority", "summary", "targets",
  ])
  const pending: Array<[unknown, string]> = [[value, ""]]
  while (pending.length > 0) {
    const [candidate, pointer] = pending.pop()!
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) =>
        pending.push([item, `${pointer}/${index}`]))
      continue
    }
    if (!candidate || typeof candidate !== "object") continue
    for (const [key, item] of Object.entries(candidate)) {
      if (copiedKeys.has(key)) {
        report(`${pointer}/${key}`, "copied_authority_body", key)
      }
      pending.push([item, `${pointer}/${key}`])
    }
  }
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
  if (!validate(value)) {
    for (const error of validate.errors ?? []) {
      const pointer = error.keyword === "additionalProperties"
        ? `${error.instancePath}/${error.params.additionalProperty}`
        : error.instancePath || "/"
      report(pointer, "schema_invalid",
        `${error.keyword}:${error.message ?? "invalid"}`)
    }
    return { diagnostics: sortServiceAuthorityBindingDiagnostics(diagnostics) }
  }
  const binding = value as ServiceAuthorityBinding
  diagnostics.push(
    ...findServiceAuthorityBindingIdentityDiagnostics(binding, context),
    ...findServiceAuthorityBindingManifestDiagnostics(binding, context),
    ...findServiceAuthorityBindingDebtDiagnostics(binding, context),
    ...await findServiceAuthorityBindingExecutionDiagnostics(binding, context),
  )
  sortServiceAuthorityBindingDiagnostics(diagnostics)
  return diagnostics.length > 0 ? { diagnostics } : { binding, diagnostics }
}
