import type {
  ExecutionAuthority,
  ExecutionAuthorityDiagnostic,
} from "./execution_authority_types.ts"
import { findContained } from "./find_execution_authority_containment.ts"

const requiredEscalations = [
  "allow_deny_overlap", "ambiguous_authority", "base_revision_drift",
  "contract_mismatch", "cross_owner_target", "debt_derived_authority",
  "external_authority_missing", "manifest_mismatch", "path_escape",
  "protected_operation", "provider_leakage", "secret_value", "unknown_version",
]
const protectedOperations = [
  "deployment", "destructive", "production", "restoration", "runtime",
]

export function findExecutionAuthorityOverlapDiagnostics(
  grant: ExecutionAuthority,
): ExecutionAuthorityDiagnostic[] {
  const diagnostics: ExecutionAuthorityDiagnostic[] = []
  const report = (field_path: string, code: string, target: string) => {
    diagnostics.push({ grant_id: grant.grant_id, field_path, code, target,
      message: `${code}: ${target}` })
  }
  const paths = [...grant.filesystem.read, ...grant.filesystem.write]
    .map((item) => ({
      target: item.path,
      recursive: item.kind === "directory" && item.recursive,
    }))
  const database = [...grant.database.read, ...grant.database.write]
    .map((item) => ({
      target: item.qualified_object,
      recursive: item.object_kind === "schema",
    }))
  const externalActions = grant.external.invoke.filter((allowed) =>
    grant.forbidden.external_actions.some((denied) =>
      allowed.authority_key === denied.authority_key &&
      allowed.operation === denied.operation &&
      allowed.resource === denied.resource)).map((item) => JSON.stringify(item))
  const overlaps: Array<[string, string[]]> = [
    ["paths", findContained(paths, grant.forbidden.paths, "/")],
    ["database_objects", findContained(
      database, grant.forbidden.database_objects, ".",
    )],
    ["contracts", grant.contracts.call.map((item) => item.contract).filter(
      (target) => grant.forbidden.contracts.includes(target))],
    ["hosts", grant.network.connect.map((item) => item.host).filter(
      (target) => grant.forbidden.hosts.includes(target))],
    ["secret_names", grant.secrets.reference.filter(
      (target) => grant.forbidden.secret_names.includes(target))],
    ["external_actions", externalActions],
  ]
  overlaps.forEach(([field, targets]) => targets.forEach((target) =>
    report(`/forbidden/${field}`, "allow_deny_overlap", target)))
  const directServices = [
    ...grant.contracts.call.map((item) => item.provider_service),
    ...grant.database.read.map((item) => item.owner_service),
    ...grant.database.write.map((item) => item.owner_service),
  ]
  directServices.filter((service) => grant.forbidden.services.includes(service))
    .forEach((service) =>
      report("/forbidden/services", "allow_deny_overlap", service))
  requiredEscalations.filter((item) => !grant.escalate_on.includes(item))
    .forEach((item) => report("/escalate_on", "escalation_missing", item))
  protectedOperations.filter((item) =>
    !grant.forbidden.operation_classes.includes(item)).forEach((item) =>
      report("/forbidden/operation_classes", "protected_operation", item))
  if (grant.provenance.issue_authorization.source !==
    `linear:${grant.work_item}`) {
    report("/provenance/issue_authorization", "provenance_missing",
      grant.work_item)
  }
  if (!grant.provenance.accepted_decisions.some((item) =>
    item.digest === grant.source_digest)) {
    report("/provenance/accepted_decisions", "provenance_missing",
      grant.source_digest)
  }
  return diagnostics
}
