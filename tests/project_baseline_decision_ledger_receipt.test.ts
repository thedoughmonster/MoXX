import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name: string) => readFile(new URL(name, import.meta.url), "utf8");
const [entry, lifecycle, bootstrap, security, concurrency] = await Promise.all([
  read("project_baseline_decision_ledger.pg.sql"),
  read("project_baseline_decision_ledger_lifecycle.pg.sql"),
  read("project_baseline_decision_ledger_bootstrap.pg.sql"),
  read("project_baseline_decision_ledger_security.pg.sql"),
  read("project_baseline_decision_ledger_concurrency.test.ts"),
]);

test("runs every receipt companion inside one rollback transaction", () => {
  assert.match(entry, /^\\set ON_ERROR_STOP on\nbegin;/u);
  assert.match(entry, /\\ir project_baseline_decision_ledger_lifecycle\.pg\.sql/u);
  assert.match(entry, /\\ir project_baseline_decision_ledger_bootstrap\.pg\.sql/u);
  assert.match(entry, /\\ir project_baseline_decision_ledger_security\.pg\.sql/u);
  assert.match(entry, /rollback;\s*$/u);
});

test("runtime receipt covers every lifecycle and terminal behavior", () => {
  for (const status of ["rejected", "revoked", "superseded"]) {
    assert.match(lifecycle, new RegExp("'" + status + "'", "u"));
    assert.match(lifecycle, new RegExp(status + " decision accepted a later event", "u"));
  }
  assert.match(lifecycle, /unaccepted superseding target was accepted/u);
  assert.match(lifecycle, /related_decision_id/u);
  assert.match(lifecycle, /source\/idempotency split collision was accepted/u);
});

test("runtime receipt proves canonical bootstrap failures", () => {
  assert.match(bootstrap, /changed bootstrap entry digest was accepted/u);
  assert.match(bootstrap, /changed bootstrap manifest was accepted/u);
  assert.match(bootstrap, /reordered bootstrap manifest was accepted/u);
  assert.match(bootstrap, /bootstrap replay failed/u);
});

test("runtime receipts reconstruct digests and prove target-lock freshness", () => {
  assert.match(entry, /NULL provenance preimage was accepted/u);
  assert.match(entry, /NULL bootstrap entry was accepted/u);
  for (const invalidCase of [
    "missing schema_version", "JSON null schema_version",
    "string schema_version", "wrong schema_version type",
    "wrong schema_version value", "missing encoding", "JSON null encoding",
    "wrong encoding type", "wrong encoding value", "missing content",
    "non-string content", "extra key",
  ]) {
    assert.match(entry, new RegExp(invalidCase, "u"));
  }
  assert.match(entry, /changed expected digest was accepted/u);
  assert.match(entry, /provenance_digest_v1/u);
  assert.match(entry, /source_identity_preimage/u);
  assert.match(entry, /event_source_preimage/u);
  assert.match(entry, /digest_preimage/u);
  assert.match(concurrency, /supersession did not block on the target lock/u);
  assert.match(concurrency, /superseding decision must currently be accepted/u);
});

test("runtime receipt covers privilege, RLS, and mutation controls", () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.match(security, new RegExp("'" + role + "'", "u"));
  }
  assert.match(security, /has_schema_privilege/u);
  assert.match(security, /has_table_privilege/u);
  assert.match(security, /has_function_privilege/u);
  assert.match(security, /relrowsecurity and c\.relforcerowsecurity/u);
  assert.match(security, /from pg_policy/u);
  for (const mutation of ["update", "delete", "truncate"]) {
    assert.match(security, new RegExp(mutation + " accepted for", "u"));
  }
});
