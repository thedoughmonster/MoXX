import assert from "node:assert/strict";

import type { Sql } from "postgres";

import { registrationSql } from "./harness.ts";

export async function assertRegistration(sql: Sql): Promise<void> {
  const [registration] = await sql<{
    capture_contract_key: string;
    active: boolean;
    index_definition: string;
  }[]>`
    select source.capture_contract_key, source.active,
      pg_get_indexdef(indexes.indexrelid) as index_definition
    from momi_communications.source_types source
    cross join pg_index indexes
    join pg_class index_class on index_class.oid = indexes.indexrelid
    where source.source_type = 'square_payment_webhook'
      and index_class.relname =
        'archive_items_square_payment_webhook_replay_unique'`;
  assert.equal(
    registration?.capture_contract_key,
    "momi.raw_json.capture_evidence.v1",
  );
  assert.equal(registration?.active, true);
  assert.match(
    registration?.index_definition ?? "",
    /UNIQUE INDEX[\s\S]*\(source_type, source_account_key, idempotency_key\)/,
  );
  assert.match(
    registration?.index_definition ?? "",
    /WHERE \(source_type = 'square_payment_webhook'::text\)/,
  );

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
      update momi_communications.source_types
      set capture_contract_key = 'conflicting.capture.contract', active = false
      where source_type = 'square_payment_webhook'`;
      await transaction.unsafe(await registrationSql());
    }),
    /Square payment webhook archive registration conflicts/,
  );
}
