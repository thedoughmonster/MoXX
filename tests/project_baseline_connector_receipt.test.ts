import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [connector, core, lifecycle, bootstrap, security, readback, runbook] =
  await Promise.all([
    readFile(new URL("project_baseline_decision_ledger_connector.pg.sql", import.meta.url), "utf8"),
    readFile(new URL("project_baseline_decision_ledger.pg.sql", import.meta.url), "utf8"),
    readFile(new URL("project_baseline_decision_ledger_lifecycle.pg.sql", import.meta.url), "utf8"),
    readFile(new URL("project_baseline_decision_ledger_bootstrap.pg.sql", import.meta.url), "utf8"),
    readFile(new URL("project_baseline_decision_ledger_security.pg.sql", import.meta.url), "utf8"),
    readFile(new URL("project_baseline_bootstrap_readback.pg.sql", import.meta.url), "utf8"),
    readFile(new URL("../docs/project-baseline-decision-ledger.md", import.meta.url), "utf8"),
  ]);

function buildConnectorReceipt(parts: string[]): string {
  let entry = parts[0].replace(/^\\set ON_ERROR_STOP on\nbegin;\n\n/u, "");
  entry = entry.replace(
    /\n\\ir project_baseline_decision_ledger_lifecycle\.pg\.sql\n\n\\ir project_baseline_decision_ledger_bootstrap\.pg\.sql\n\\ir project_baseline_decision_ledger_security\.pg\.sql\n\nrollback;\s*$/u,
    "",
  );
  return "begin;\n\n" + [entry, ...parts.slice(1)]
    .map((part) => part.trim()).join("\n\n") + "\n\nrollback;\n";
}

test("pins the connector-ready rollback receipt to its four owned sources", () => {
  assert.equal(connector, buildConnectorReceipt([core, lifecycle, bootstrap, security]));
  assert.doesNotMatch(connector, /\\(?:set|ir)\b/u);
  assert.doesNotMatch(connector, /\bcreate\s+(?:or\s+replace\s+)?function\b/iu);
  const digest = createHash("sha256").update(connector, "utf8").digest("hex");
  assert.equal(digest, "b1d005668e09b3c1ddbfcf36821b45cdd5b0c77daa0564e2b9bdebc5dd079d0d");
  assert.match(runbook, new RegExp(digest, "u"));
});

test("provides one fixed scoped bootstrap readback query", () => {
  for (const field of [
    "reconciliation_id", "decision_mapping", "mapping_digest", "reconciled_at",
    "mapping_entries", "manifest_digest", "decisions", "events",
  ]) assert.match(readback, new RegExp(field, "u"));
  assert.match(readback, /'valid'/u);
  assert.match(readback, /d89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a/u);
  assert.doesNotMatch(readback, /\b(?:insert|update|delete|truncate|alter|drop)\b/iu);
});
