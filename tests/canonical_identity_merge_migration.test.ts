import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(new URL(
  "../supabase/migrations/20260714191802_merge_legacy_projection_identities.sql",
  import.meta.url,
), "utf8")

test("identity chains terminate and cycles fail before version mutation", () => {
  const cycleGuard = migration.indexOf("legacy_identity_merge_cycle")
  const terminalMap = migration.indexOf("create temporary table legacy_identity_merges")
  const versionPlan = migration.indexOf("create temporary table legacy_version_plan")
  assert.ok(cycleGuard >= 0 && cycleGuard < terminalMap && terminalMap < versionPlan)
  assert.match(migration, /with recursive walk\(origin_id, canonical_id, path, cycle\)/)
  assert.match(migration, /edge\.canonical_id = any\(walk\.path\)/)
  assert.match(migration,
    /where not exists\s+\(select 1 from legacy_identity_edges edge where edge\.duplicate_id = walk\.canonical_id\)/)
})

test("reparented versions carry the survivor ID and matching content hash", () => {
  const remove = migration.indexOf("delete from momi_warehouse.entity_versions")
  const reparent = migration.lastIndexOf("update momi_warehouse.entity_versions")
  assert.ok(remove >= 0 && remove < reparent)
  assert.match(migration,
    /jsonb_set\(version\.canonical_document, '\{id\}',\s+to_jsonb\(target\.canonical_id\), true\)/)
  assert.match(migration, /content_hash = plan\.target_hash/)
  assert.match(migration, /digest\(target_document::text, 'sha256'\)/)
})

test("event references protect duplicates while history is consolidated", () => {
  assert.match(migration,
    /^-- service-owner: warehouse-projection\nbegin; lock table[\s\S]*commit;\s*$/)
  assert.match(migration, /lock table[\s\S]*momi_events\.events in share row exclusive mode/)
  assert.match(migration,
    /event\.source_reference @>[\s\S]*'table', 'entity_versions'[\s\S]*version\.entity_version_id/)
  assert.doesNotMatch(migration, /update momi_events\.events/)
  assert.match(migration,
    /delete from momi_warehouse\.entity_versions[\s\S]*not plan\.event_referenced/)
  assert.match(migration,
    /version_observations[\s\S]*plan\.survivor_id[\s\S]*not plan\.event_referenced/)
  assert.match(migration, /jsonb_agg\(jsonb_build_object\([\s\S]*'provenance', provenance\)/)
  assert.match(migration, /update momi_warehouse\.source_links link set entity_id = merge\.canonical_id/)
  assert.match(migration, /update momi_warehouse\.stock_observations observation/)
})
