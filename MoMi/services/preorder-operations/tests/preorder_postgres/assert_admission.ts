import assert from "node:assert/strict";

import type { Sql } from "postgres";

export async function assertAdmission(sql: Sql): Promise<void> {
  const principal = `rate-principal-${crypto.randomUUID()}`;
  for (let index = 0; index < 20; index += 1) {
    const [row] = await sql<{ admitted: boolean }[]>`
      select momi_preorder.admit_public_request_v1(
        'momi.preorder.order_intent.create.v1', ${principal}
      ) as admitted`;
    assert.equal(row?.admitted, true);
  }
  const [limited] = await sql<{ admitted: boolean }[]>`
    select momi_preorder.admit_public_request_v1(
      'momi.preorder.order_intent.create.v1', ${principal}
    ) as admitted`;
  assert.equal(limited?.admitted, false);
  const [unknown] = await sql<{ admitted: boolean }[]>`
    select momi_preorder.admit_public_request_v1('unknown.contract', ${principal})
      as admitted`;
  assert.equal(unknown?.admitted, false);
  const [privacy] = await sql<{ raw_principal_rows: number }[]>`
    select count(*)::integer as raw_principal_rows
    from momi_preorder.public_request_rate_buckets
    where principal_hash = ${principal}`;
  assert.equal(privacy?.raw_principal_rows, 0);
  const [global] = await sql<{ admitted: number; limited: number }[]>`
    select count(*) filter (where admitted)::integer as admitted,
      count(*) filter (where not admitted)::integer as limited
    from (
      select momi_preorder.admit_public_request_v1(
        'momi.preorder.order_intent.create.v1',
        'global-test-' || extensions.gen_random_uuid()::text
      ) as admitted
      from generate_series(1, 100)
    ) attempts`;
  assert.deepEqual(global, { admitted: 99, limited: 1 });
}
