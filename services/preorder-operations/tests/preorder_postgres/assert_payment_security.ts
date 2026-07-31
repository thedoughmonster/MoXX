import assert from "node:assert/strict";

import type { Sql } from "postgres";

export async function assertPaymentSecurity(sql: Sql) {
  await assert.rejects(sql.begin(async (transaction) => {
    await transaction.unsafe("set local role anon");
    await transaction`select * from momi_preorder.payment_attempts limit 1`;
  }), /permission denied/);
  await sql.begin(async (transaction) => {
    await transaction.unsafe("set local role service_role");
    const [result] = await transaction<{ value: Record<string, unknown> }[]>`
      select momi_preorder.claim_payment_attempt_v1(
        ${transaction.json({ command_id: crypto.randomUUID(),
          order_id: crypto.randomUUID(), expected_order_version: 1 })}::jsonb,
        ${`authority-${crypto.randomUUID()}`}, 'sandbox-location-logic-test'
      ) as value`;
    assert.equal((result?.value.error as Record<string, unknown>)?.code,
      "not_authorized");
  });
  const principal = `payment-rate-${crypto.randomUUID()}`;
  for (let index = 0; index < 10; index += 1) {
    const [admission] = await sql<{ admitted: boolean }[]>`
      select momi_preorder.admit_public_request_v1(
        'momi.preorder.payment.initiate.v1', ${principal}) as admitted`;
    assert.equal(admission?.admitted, true);
  }
  const [limited] = await sql<{ admitted: boolean }[]>`
    select momi_preorder.admit_public_request_v1(
      'momi.preorder.payment.initiate.v1', ${principal}) as admitted`;
  assert.equal(limited?.admitted, false);
  const [security] = await sql<{
    anon_attempts: boolean; authenticated_evidence: boolean;
    rls_count: number; service_claim: boolean; anon_claim: boolean;
    service_project: boolean; helper_public: boolean;
  }[]>`
    select
      has_table_privilege('anon', 'momi_preorder.payment_attempts', 'select')
        as anon_attempts,
      has_table_privilege('authenticated', 'momi_preorder.payment_evidence',
        'select') as authenticated_evidence,
      (select count(*)::integer from pg_class c join pg_namespace n
        on n.oid = c.relnamespace where n.nspname = 'momi_preorder'
        and c.relname in ('payment_attempts', 'payment_evidence')
        and c.relrowsecurity) as rls_count,
      has_function_privilege('service_role',
        'momi_preorder.claim_payment_attempt_v1(jsonb,text,text)', 'execute')
        as service_claim,
      has_function_privilege('anon',
        'momi_preorder.claim_payment_attempt_v1(jsonb,text,text)', 'execute')
        as anon_claim,
      has_function_privilege('service_role',
        'momi_preorder.project_payment_evidence_v1(uuid,uuid,jsonb)', 'execute')
        as service_project,
      has_function_privilege('public',
        'momi_preorder.payment_receipt_v1(uuid)', 'execute') as helper_public`;
  assert.deepEqual(security, {
    anon_attempts: false, authenticated_evidence: false, rls_count: 2,
    service_claim: true, anon_claim: false, service_project: true,
    helper_public: false,
  });
  const [privacy] = await sql<{
    token_columns: number; payload_columns: number; customer_rows: number;
  }[]>`
    select
      (select count(*)::integer from information_schema.columns
        where table_schema = 'momi_preorder'
          and table_name like 'payment_%'
          and column_name like '%token%') as token_columns,
      (select count(*)::integer from information_schema.columns
        where table_schema = 'momi_preorder'
          and table_name like 'payment_%'
          and column_name like '%payload%') as payload_columns,
      (select count(*)::integer from momi_preorder.payment_attempts
        where accepted_terms::text like '%payment@example.test%') as customer_rows`;
  assert.deepEqual(privacy, {
    token_columns: 0, payload_columns: 0, customer_rows: 0,
  });
}
