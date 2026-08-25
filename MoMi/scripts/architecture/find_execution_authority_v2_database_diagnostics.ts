import { canonicalJson } from "../dev_loop/canonical_json.ts"
import { databaseObjectAuthorityDiagnostic } from
  "./database_object_authority_diagnostic.ts"
import { databaseObjectIdentityKey } from "./database_object_identity_key.ts"
import type { DatabaseObjectAuthorityDiagnostic } from
  "./database_object_authority_types.ts"
import type {
  ExecutionAuthorityV2,
  ExecutionAuthorityV2Context,
} from "./execution_authority_v2_types.ts"
import { sortDatabaseObjectAuthorityDiagnostics } from
  "./sort_database_object_authority_diagnostics.ts"

export function findExecutionAuthorityV2DatabaseDiagnostics(
  grant: ExecutionAuthorityV2,
  context: ExecutionAuthorityV2Context,
): DatabaseObjectAuthorityDiagnostic[] {
  const authority = context.databaseObjectAuthority
  const diagnostics: DatabaseObjectAuthorityDiagnostic[] = []
  const add = (index: number, code: string, identity: string, mode = "") =>
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: grant.grant_id, layer: "positive_authority",
      json_pointer: `/database/capabilities/${index}`, code,
      object_class: grant.database.capabilities[index]?.object.class ?? "",
      canonical_identity: identity, mode,
    }))
  const pin = grant.database.authority
  const expectedPin = {
    repository: authority.repository, revision: authority.revision,
    source_digest: authority.source_digest,
    authority_digest: authority.authority_digest,
  }
  if (canonicalJson(pin) !== canonicalJson(expectedPin)) {
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: grant.grant_id, layer: "positive_authority",
      json_pointer: "/database/authority", code: "source_digest_drift",
      canonical_identity: canonicalJson(pin),
    }))
  }
  if (grant.database.capabilities.length > 0 &&
    grant.provenance.manifests.length === 0) {
    diagnostics.push(databaseObjectAuthorityDiagnostic({
      subject: grant.grant_id, layer: "positive_authority",
      json_pointer: "/provenance/manifests", code: "provenance_missing",
      canonical_identity: "manifests",
    }))
  }
  const seen = new Set<string>()
  for (const [index, capability] of grant.database.capabilities.entries()) {
    const identity = databaseObjectIdentityKey(capability.object)
    const qualified = `${capability.object.schema}.${capability.object.name}`
    const capabilityKey = canonicalJson([identity, capability.mode])
    if (seen.has(capabilityKey)) add(index, "duplicate_authority", identity,
      capability.mode)
    seen.add(capabilityKey)
    if (grant.forbidden.database_objects.some((item) =>
      item === qualified || qualified.startsWith(`${item}.`))) {
      add(index, "allow_deny_overlap", identity, capability.mode)
    }
    const expectedModes = capability.object.class === "relation"
      ? ["relation.read", "relation.write"] : capability.object.class === "routine"
      ? ["routine.call"] : ["sequence.use"]
    if (!expectedModes.includes(capability.mode)) {
      add(index, "object_mode_mismatch", identity, capability.mode)
      continue
    }
    const targets = authority.objects.filter((item) =>
      databaseObjectIdentityKey(item.identity) === identity)
    if (targets.length === 0) {
      add(index, context.debtTargets.includes(qualified)
        ? "debt_derived_authority" : "unknown_object", identity, capability.mode)
      continue
    }
    const owners = [...new Set(targets.map((item) => item.owner_service))]
    if (owners.length !== 1) {
      add(index, "target_owner_ambiguous", identity, capability.mode)
      continue
    }
    const owner = owners[0]!
    if (grant.forbidden.services.includes(owner)) {
      add(index, "allow_deny_overlap", identity, capability.mode)
    }
    const compatible = (sourceMode: "database.read" | "database.write") =>
      authority.runtime_compatibility.some((item) => item.service === grant.service &&
        item.source_mode === sourceMode && (item.scope.kind === "exact_object"
          ? databaseObjectIdentityKey(item.scope.object) === identity
          : item.scope.schema === capability.object.schema))
    if (owner === grant.service) {
      const accepted = capability.mode === "relation.read" ? compatible("database.read")
        : capability.mode === "relation.write" ? compatible("database.write")
        : compatible("database.read") || compatible("database.write")
      if (!accepted) add(index, "manifest_mismatch", identity, capability.mode)
      continue
    }
    if (capability.mode === "relation.write") {
      add(index, "cross_owner_target", identity, capability.mode)
      continue
    }
    const mappings = authority.public_mappings.filter((item) =>
      item.provider_service === owner &&
      databaseObjectIdentityKey(item.object) === identity)
    if (mappings.length === 0) {
      add(index, "public_mapping_missing", identity, capability.mode)
      continue
    }
    const accepted = mappings.some((mapping) => {
      const called = grant.contracts.call.some((item) =>
        item.provider_service === owner && item.contract === mapping.contract)
      const consumer = mapping.mapping_kind !== "dynamic_read_routines" ||
        mapping.consumer_service === grant.service
      const sourceMode = mapping.mapping_kind === "public_routine_commands"
        ? "database.write" : "database.read"
      return called && consumer && compatible(sourceMode)
    })
    if (!accepted) add(index, "public_mapping_mismatch", identity, capability.mode)
  }
  return sortDatabaseObjectAuthorityDiagnostics(diagnostics)
}
