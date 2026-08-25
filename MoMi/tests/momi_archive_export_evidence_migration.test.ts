import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("keeps manual export evidence append-only and derives due status", async () => {
  const migration = await readFile(new URL(
    "../supabase/migrations/20260715150000_harden_manual_export_evidence.sql",
    import.meta.url,
  ), "utf8")

  assert.match(migration, /^-- service-owner: warehouse-read-api/)
  assert.match(migration, /add column export_kind text not null default 'legacy'/)
  assert.match(migration, /alter column export_kind set default 'monthly'/)
  assert.match(migration, /export_runs_size_required[\s\S]*not valid/)
  assert.match(migration, /before update or delete on momi_archive\.export_runs/)
  assert.match(migration, /errcode = '55000'/)
  assert.match(migration, /before truncate on momi_archive\.export_runs/)
  assert.match(migration, /create view momi_archive\.product_export_status_v1/)
  assert.match(migration, /left join lateral/)
  assert.match(migration, /latest\.exported_at[\s\S]*\+ make_interval/)
  assert.match(migration, /gap\.next_due_at > latest\.exported_at/)
  assert.match(migration, /create view momi_archive\.manual_export_findings_v1/)
  assert.match(migration, /MANUAL_EXPORT_DUE/)
  assert.match(migration, /MANUAL_EXPORT_EVIDENCE_INVALID/)
  assert.match(migration, /exported_at <= recorded_at \+ interval '5 minutes'/)
})
