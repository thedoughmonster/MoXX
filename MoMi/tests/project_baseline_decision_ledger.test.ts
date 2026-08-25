import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const migration = new URL("../supabase/migrations/20260817000735_project_baseline_decision_ledger.sql", import.meta.url);
const sql = await readFile(migration, "utf8");
const functionBody = (name: string) => sql.match(new RegExp(
  "create function momi_governance\\." + name + "[\\s\\S]+?\\n\\$\\$;", "u"))?.[0] ?? "";
const appendFunction = functionBody("append_decision_event_v1");
const bootstrapFunction = functionBody("reconcile_bootstrap_v1");
const historyFunction = functionBody("read_decision_history_v1");
const provenanceFunction = functionBody("provenance_digest_v1");
const preimageFunction = functionBody("canonicalize_provenance_preimage_v1");
const bootstrapEntryFunction = functionBody("canonicalize_bootstrap_entry_v1");
test("declares stable identities and the full append-only lifecycle", () => {
  assert.match(sql, /^-- service-owner: project-baseline-governance/u);
  assert.match(sql, /create schema momi_governance/u);
  assert.match(sql, /create table momi_governance\.material_decisions/u);
  assert.match(sql, /create table momi_governance\.decision_events/u);
  const statuses = ["proposed", "accepted", "rejected", "superseded", "revoked"];
  for (const status of statuses) {
    assert.match(sql, new RegExp("'" + status + "'", "u"));
  }
  assert.match(sql, /unique \(source_kind, source_decision_id\)/u);
  assert.match(sql, /unique \(decision_id, decision_version\)/u);
});
test("enforces legal lifecycle transitions and supersession targets", () => {
  assert.match(
    appendFunction,
    /v_last_status = 'proposed'[\s\S]+p_lifecycle_status in \('accepted', 'rejected'\)/u,
  );
  assert.match(
    appendFunction,
    /v_last_status = 'accepted'[\s\S]+p_lifecycle_status in \('superseded', 'revoked'\)/u,
  );
  assert.match(appendFunction, /Illegal material-decision lifecycle transition/u);
  assert.match(appendFunction, /superseding decision must currently be accepted/u);
  assert.match(appendFunction, /unnest\(array\[/u);
  assert.match(appendFunction, /order by candidate\.decision_id/u);
});
test("binds immutable evidence and external references to events", () => {
  assert.match(sql, /create table momi_governance\.decision_evidence/u);
  assert.match(sql, /create table momi_governance\.decision_external_references/u);
  assert.match(sql, /decision_events_id_decision_unique/u);
  assert.match(sql, /foreign key \(event_id, decision_id\)/gmu);
  assert.match(sql, /decision_evidence_decision_idx/u);
  assert.match(sql, /decision_external_references_decision_idx/u);
  assert.match(appendFunction, /insert into momi_governance\.decision_evidence/u);
  assert.match(appendFunction, /insert into momi_governance\.decision_external_references/u);
  assert.match(appendFunction, /'evidence', v_evidence/u);
  assert.match(appendFunction, /'external_references', v_references/u);
  assert.match(sql, /canonicalize_provenance_preimage_v1/u);
  assert.match(provenanceFunction, /convert_to\(v_preimage->>'content', 'UTF8'\)/u);
  assert.match(preimageFunction,
    /jsonb_typeof\(p_preimage\) is distinct from 'object'[\s\S]+p_preimage->'schema_version' is distinct from '1'::jsonb[\s\S]+p_preimage->'encoding' is distinct from '"utf-8"'::jsonb[\s\S]+jsonb_typeof\(p_preimage->'content'\) is distinct from 'string'/u);
  assert.match(bootstrapEntryFunction,
    /p_entry->'schema_version' is distinct from '1'::jsonb/u);
  assert.match(appendFunction, /digest does not match its canonical preimage/gmu);
});
test("requires one event source identity and idempotency key", () => {
  assert.match(sql, /unique \(event_source_kind, event_source_id\)/u);
  assert.match(sql, /unique \(caller_idempotency_key\)/u);
  assert.match(appendFunction, /v_collision_count > 1/u);
  assert.match(appendFunction, /Event replay changed content or identity/u);
  assert.match(appendFunction, /v_existing_event\.content_digest <>/u);
  assert.match(appendFunction, /false;\n    return;/u);
});
test("computes and verifies canonical bootstrap digests in Postgres", () => {
  assert.match(bootstrapFunction, /canonicalize_bootstrap_entry_v1/u);
  assert.match(bootstrapFunction, /v_entry_digest := encode\(extensions\.digest/u);
  assert.match(bootstrapFunction, /temporary digest does not match canonical entry/u);
  assert.match(bootstrapFunction, /v_computed_manifest_digest := encode\(extensions\.digest/u);
  assert.match(bootstrapFunction, /v_computed_manifest_digest <> p_expected_manifest_digest/u);
  assert.match(bootstrapFunction, /pg_advisory_xact_lock/u);
  assert.match(bootstrapFunction, /Bootstrap temporary decision IDs must be unique/u);
  assert.match(bootstrapFunction, /Superseded temporary decision must appear first/u);
  assert.match(sql, /singleton boolean not null default true unique check \(singleton\)/u);
  assert.match(bootstrapFunction, /project-baseline-pre-ledger-v1/u);
});
test("rejects update, delete, and truncate on every ledger table", () => {
  const tables = ["material_decisions", "decision_events", "decision_evidence",
    "decision_external_references", "bootstrap_reconciliations"];
  for (const table of tables) {
    assert.match(
      sql,
      new RegExp("before update or delete on momi_governance\\." + table
        + "[\\s\\S]+?reject_ledger_mutation", "u"),
    );
    assert.match(
      sql,
      new RegExp("before truncate on momi_governance\\." + table
        + "[\\s\\S]+?reject_ledger_mutation", "u"),
    );
  }
});
test("keeps the ledger private with forced RLS and indexed foreign keys", () => {
  assert.equal((sql.match(/enable row level security;/gmu) ?? []).length, 5);
  assert.equal((sql.match(/force row level security;/gmu) ?? []).length, 5);
  assert.match(sql, /revoke all on schema momi_governance/u);
  assert.match(sql, /revoke all on all tables in schema momi_governance/u);
  assert.match(sql, /revoke all on all sequences in schema momi_governance/u);
  assert.match(sql, /revoke all on all functions in schema momi_governance/u);
  assert.match(sql, /from public, anon, authenticated, service_role/u);
  assert.match(sql, /decision_events_related_decision_idx/u);
  assert.match(sql, /decision_evidence_event_key_unique/u);
  assert.match(sql, /decision_references_event_key_unique/u);
});
test("returns versioned history with a current projection", () => {
  assert.match(historyFunction, /'current_projection'/u);
  assert.match(historyFunction, /'history', v_history/u);
  assert.match(historyFunction, /order by event_row\.decision_version/u);
  assert.match(historyFunction, /decision_evidence evidence_row/u);
  assert.match(historyFunction, /decision_external_references reference_row/u);
});
test("retains static checks while requiring a real dev transaction receipt", async () => {
  const runbook = await readFile(
    new URL("../docs/project-baseline-decision-ledger.md", import.meta.url), "utf8");
  assert.match(runbook, /Static repository tests do not prove runtime behavior/u);
  assert.match(runbook, /real development transaction receipt/u);
  assert.match(runbook, /ROLLBACK/u);
});
