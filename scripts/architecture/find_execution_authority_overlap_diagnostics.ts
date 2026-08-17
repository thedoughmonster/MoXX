import type {
  ExecutionAuthority,
  ExecutionAuthorityDiagnostic,
} from "./execution_authority_types.ts"

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
  const overlaps: Array<[string, string[], string[]]> = [
    ["paths", [...grant.filesystem.read, ...grant.filesystem.write].map((x) => x.path), grant.forbidden.paths],
    ["database_objects", [...grant.database.read, ...grant.database.write].map((x) => x.qualified_object), grant.forbidden.database_objects],
    ["contracts", grant.contracts.call.map((x) => x.contract), grant.forbidden.contracts],
    ["hosts", grant.network.connect.map((x) => x.host), grant.forbidden.hosts],
    ["secret_names", grant.secrets.reference, grant.forbidden.secret_names],
    ["external_actions", grant.external.invoke.map((x) =>
      `${x.authority_key}:${x.operation}:${x.resource}`),
      grant.forbidden.external_actions.map((x) =>
        `${x.authority_key}:${x.operation}:${x.resource}`)],
  ]
  overlaps.forEach(([field, allowed, denied]) => allowed.filter((target) =>
    denied.includes(target)).forEach((target) =>
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
  if (grant.provenance.issue_authorization.source !== `linear:${grant.work_item}`) {
    report("/provenance/issue_authorization", "provenance_missing", grant.work_item)
  }
  if (!grant.provenance.accepted_decisions.some((item) =>
    item.digest === grant.source_digest)) {
    report("/provenance/accepted_decisions", "provenance_missing",
      grant.source_digest)
  }
  return diagnostics
}
