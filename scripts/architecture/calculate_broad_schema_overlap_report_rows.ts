import { canonicalJson } from "../dev_loop/canonical_json.ts"
import type { LegacyAccessGovernanceFinding } from
  "../constitution/legacy_access_governance_report_types.ts"
import { compareUtf16 } from "./compare_utf16.ts"
import { broadSchemaOverlapReportRowIdentity } from
  "./broad_schema_overlap_report_row_identity.ts"
import type {
  BroadSchemaOverlapClassification,
  BroadSchemaOverlapRow,
} from "./broad_schema_overlap_report_types.ts"
import type { DatabaseObjectAuthority } from
  "./database_object_authority_types.ts"

export function calculateBroadSchemaOverlapReportRows(
  authority: DatabaseObjectAuthority,
  debtFindings: LegacyAccessGovernanceFinding[],
): BroadSchemaOverlapRow[] {
  const debtByKey = new Map<string, string[]>()
  for (const finding of debtFindings) {
    if (finding.rule_id !== "direct_private_relation_access") continue
    const key = canonicalJson([finding.consumer_service,
      `database.${finding.access_mode}`, finding.object.identity,
      finding.owner_service])
    debtByKey.set(key, [...new Set([...(debtByKey.get(key) ?? []),
      finding.fingerprint])].sort(compareUtf16))
  }
  const relations = authority.objects.filter((item) =>
    item.identity.class === "relation")
  const rows: BroadSchemaOverlapRow[] = []
  for (const declaration of authority.runtime_compatibility) {
    if (declaration.scope.kind !== "historical_broad_migration_debt") continue
    const broadSchema = declaration.scope.schema
    const matches = relations.filter((item) =>
      item.identity.schema === broadSchema)
    if (matches.length === 0) {
      const row: BroadSchemaOverlapRow = {
        row_identity: "", declaring_service: declaration.service,
        compatibility_mode: declaration.source_mode, broad_schema: broadSchema,
        declaration_source: { source_path: declaration.source_path,
          json_pointer: declaration.json_pointer }, exact_relation: null,
        owner_service: null, relation_kind: null, object_source: null,
        classification: "undiscoverable", debt_fingerprints: [],
      }
      row.row_identity = broadSchemaOverlapReportRowIdentity(row)
      rows.push(row)
      continue
    }
    for (const object of matches) {
      if (object.identity.class !== "relation") continue
      const key = canonicalJson([declaration.service, declaration.source_mode,
        `${object.identity.schema}.${object.identity.name}`,
        object.owner_service])
      const fingerprints = debtByKey.get(key) ?? []
      const classification: BroadSchemaOverlapClassification =
        object.owner_service === declaration.service ? "same-owner" :
          fingerprints.length > 0 ? "known-direct-debt" : "cross-owner"
      const row: BroadSchemaOverlapRow = {
        row_identity: "", declaring_service: declaration.service,
        compatibility_mode: declaration.source_mode, broad_schema: broadSchema,
        declaration_source: { source_path: declaration.source_path,
          json_pointer: declaration.json_pointer },
        exact_relation: object.identity, owner_service: object.owner_service,
        relation_kind: object.relation_kind ?? null,
        object_source: { source_path: object.source_path,
          json_pointer: object.json_pointer,
          replay_identity: object.replay_identity }, classification,
        debt_fingerprints: classification === "known-direct-debt"
          ? fingerprints : [],
      }
      row.row_identity = broadSchemaOverlapReportRowIdentity(row)
      rows.push(row)
    }
  }
  return rows.sort((left, right) =>
    compareUtf16(left.row_identity, right.row_identity))
}
