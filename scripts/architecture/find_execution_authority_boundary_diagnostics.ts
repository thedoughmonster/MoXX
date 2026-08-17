import type {
  ExecutionAuthority,
  ExecutionAuthorityContext,
  ExecutionAuthorityDiagnostic,
} from "./execution_authority_types.ts"

export function findExecutionAuthorityBoundaryDiagnostics(
  grant: ExecutionAuthority,
  context: ExecutionAuthorityContext,
): ExecutionAuthorityDiagnostic[] {
  const diagnostics: ExecutionAuthorityDiagnostic[] = []
  const report = (field_path: string, code: string, target: string) => {
    diagnostics.push({ grant_id: grant.grant_id, field_path, code, target,
      message: `${code}: ${target}` })
  }
  const manifest = context.services[grant.service]
  if (grant.provenance.repository_rules.length === 0) {
    report("/provenance/repository_rules", "provenance_missing",
      "repository_rules")
  }
  const manifestBound = grant.database.read.length > 0 ||
    grant.database.write.length > 0 || grant.network.connect.length > 0 ||
    grant.secrets.reference.length > 0 || grant.packages.use.length > 0
  if (manifestBound && grant.provenance.manifests.length === 0) {
    report("/provenance/manifests", "provenance_missing", "manifests")
  }
  if (grant.contracts.call.length > 0 &&
    grant.provenance.contracts.length === 0) {
    report("/provenance/contracts", "provenance_missing", "contracts")
  }
  if (grant.external.invoke.length > 0 &&
    grant.provenance.external_authorities.length === 0) {
    report("/provenance/external_authorities", "provenance_missing",
      "external_authorities")
  }
  if (!manifest) report("/service", "manifest_mismatch", grant.service)
  const providers = new Set(grant.contracts.call.map((item) =>
    item.provider_service))
  const debt = new Set(context.debtTargets)
  grant.provenance.legacy_debt.forEach((item) =>
    item.targets.forEach((target) => debt.add(target)))
  for (const mode of ["read", "write"] as const) {
    for (const [index, item] of grant.database[mode].entries()) {
      const path = `/database/${mode}/${index}`
      const schemaWide = item.object_kind === "schema"
      if (schemaWide === item.qualified_object.includes(".")) {
        report(`${path}/qualified_object`, "object_kind_mismatch",
          item.qualified_object)
      }
      if (item.owner_service !== grant.service) {
        report(`${path}/owner_service`, "cross_owner_target", item.owner_service)
        if (providers.has(item.owner_service)) {
          report(path, "provider_leakage", item.qualified_object)
        }
      }
      const schemaName = item.qualified_object.split(".")[0]
      const allowed = manifest?.database[mode].some((entry) =>
        entry === schemaName || entry === item.qualified_object)
      if (!allowed) report(path, "manifest_mismatch", item.qualified_object)
      if (debt.has(item.qualified_object)) {
        report(path, "debt_derived_authority", item.qualified_object)
      }
    }
  }
  for (const [index, item] of grant.contracts.call.entries()) {
    const key = `${item.provider_service}:${item.contract}`
    if (!manifest?.consumes.includes(key) ||
      !context.services[item.provider_service]?.provides.includes(item.contract)) {
      report(`/contracts/call/${index}`, "contract_mismatch", key)
    }
  }
  for (const [index, item] of grant.network.connect.entries()) {
    if (item.host.includes("*") || item.host.includes("@")) {
      report(`/network/connect/${index}/host`, "wildcard_or_credentials", item.host)
    }
    if (!manifest?.network.includes(item.host)) {
      report(`/network/connect/${index}`, "manifest_mismatch", item.host)
    }
  }
  grant.secrets.reference.forEach((item, index) => {
    if (!/^[A-Z][A-Z0-9_]+$/.test(item)) {
      report(`/secrets/reference/${index}`, "secret_value", "<redacted>")
    } else if (!manifest?.secrets.includes(item)) {
      report(`/secrets/reference/${index}`, "manifest_mismatch", item)
    }
  })
  grant.packages.use.forEach((item, index) => {
    if (!manifest?.packages.includes(item)) {
      report(`/packages/use/${index}`, "manifest_mismatch", item)
    }
  })
  grant.external.invoke.forEach((item, index) => {
    const key = `${item.authority_key}:${item.operation}:${item.resource}`
    if (!context.externalAuthorities.includes(key)) {
      report(`/external/invoke/${index}`, "external_authority_missing", key)
    }
  })
  return diagnostics
}
