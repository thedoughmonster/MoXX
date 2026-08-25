import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = new URL(
  "../../../supabase/migrations/" +
    "20260801094433_register_square_payment_webhook_archive.sql",
  import.meta.url,
);

test("registers only the Square payment webhook raw-evidence source", async () => {
  const sql = await readFile(migration, "utf8");

  assert.match(sql, /^-- service-owner: communications-archive/);
  assert.equal(
    sql.match(/insert into momi_communications\.source_types/gi)?.length,
    1,
  );
  assert.match(sql, /'square_payment_webhook'/);
  assert.match(sql, /'momi\.raw_json\.capture_evidence\.v1'/);
  assert.match(sql, /active\s*\) values[\s\S]*true/);
  assert.match(sql, /on conflict \(source_type\) do update/);
  assert.match(sql, /capture_contract_key =\s*excluded\.capture_contract_key/);
  assert.match(
    sql,
    /raise exception 'Square payment webhook archive registration conflicts'/,
  );
  assert.match(sql, /using errcode = '23505'/);
  assert.doesNotMatch(sql, /'(?:trello_webhook|openai|momi_gateway)'/);
});

test("adds only the source-scoped replay identity index", async () => {
  const sql = await readFile(migration, "utf8");

  assert.match(
    sql,
    /create unique index\s+archive_items_square_payment_webhook_replay_unique/,
  );
  assert.match(
    sql,
    /on momi_communications\.archive_items \(\s*source_type,\s*source_account_key,\s*idempotency_key\s*\)/,
  );
  assert.match(
    sql,
    /archive_items_square_payment_webhook_replay_unique[^]*where source_type = 'square_payment_webhook'/,
  );
  assert.doesNotMatch(
    sql,
    /\b(?:create|alter|drop)\s+(?:table|function|schema|policy|trigger)\b/i,
  );
  assert.doesNotMatch(sql, /\b(?:grant|revoke)\b/i);
  assert.doesNotMatch(sql, /\b(?:delete|truncate)\b/i);
});
