import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [documentation, applySql, receiptSql] = await Promise.all([
  readFile(new URL("../docs/project-baseline-bootstrap-manifest.md", import.meta.url), "utf8"),
  readFile(
    new URL("project_baseline_bootstrap_apply_fixture.pg.sql", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("project_baseline_bootstrap_manifest.pg.sql", import.meta.url),
    "utf8",
  ),
]);

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

test("documents reconstructable instruction digest bytes", () => {
  const pattern =
    /### (PB-BOOT-\d{3})\n\nDigest:\n`([0-9a-f]{64})`\n\n```text\n([\s\S]*?)\n```/gu;
  const inputs = [...documentation.matchAll(pattern)];

  assert.equal(inputs.length, 6);
  for (const [, id, expected, bytes] of inputs) {
    assert.equal(sha256(bytes), expected, `${id} digest`);
  }
  assert.match(documentation, /PB-BOOT-005[\s\S]*coordinator-approved restatement/u);
});

test("documents reconstructable public Linear locator digests", () => {
  const rows = [...documentation.matchAll(
    /\| `(linear:[^`]+)` \| `([0-9a-f]{64})` \|/gu,
  )];

  assert.equal(rows.length, 5);
  for (const [, locator, expected] of rows) {
    assert.equal(sha256(locator), expected, locator);
  }
  assert.doesNotMatch(documentation, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-/u);
});

test("keeps fixed apply and rollback-only receipt paths separate", () => {
  const manifest =
    "d89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a";

  assert.match(applySql, new RegExp(manifest, "u"));
  assert.match(applySql, /reconcile_bootstrap_v1/u);
  assert.match(applySql, /canonicalize_bootstrap_entry_v1/u);
  assert.match(applySql, /'encoding', 'utf-8'/u);
  assert.doesNotMatch(applySql, /'encoding', 'utf8'/u);
  assert.doesNotMatch(applySql, /\bbegin;|\brollback;/u);
  assert.equal(
    receiptSql.match(/project_baseline_bootstrap_apply_fixture\.pg\.sql/gu)?.length,
    2,
  );
  assert.match(receiptSql, /^\\set ON_ERROR_STOP on\nbegin;/u);
  assert.match(receiptSql, /rollback;\s*$/u);
});
