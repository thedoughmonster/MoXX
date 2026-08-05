import assert from "node:assert/strict";

import type { Sql } from "postgres";

export async function assertSecurity(
  sql: Sql,
  recoveryAuthority: string,
): Promise<void> {
  const [privacy] = await sql<{
    command_contact_rows: number;
    raw_recovery_rows: number;
  }[]>`
    select
      count(*) filter (where response_snapshot::text like '%customer@example.test%')
        ::integer as command_contact_rows,
      (select count(*)::integer from momi_preorder.orders
        where recovery_authority_hash = ${recoveryAuthority}) as raw_recovery_rows
    from momi_preorder.commands`;
  assert.deepEqual(privacy, { command_contact_rows: 0, raw_recovery_rows: 0 });
  const [security] = await sql<{
    anon_table: boolean;
    authenticated_table: boolean;
    anon_policy_table: boolean;
    service_policy_table: boolean;
    policy_rls_count: number;
    rls_count: number;
    service_entry: boolean;
    anon_entry: boolean;
    service_helper: boolean;
    service_policy_helper: boolean;
  }[]>`
    select
      has_table_privilege('anon', 'momi_preorder.orders', 'select') as anon_table,
      has_table_privilege('authenticated', 'momi_preorder.orders', 'select')
        as authenticated_table,
      has_table_privilege('anon',
        'momi_preorder.configuration_item_policies', 'select')
        as anon_policy_table,
      has_table_privilege('service_role',
        'momi_preorder.configuration_price_classes', 'select')
        as service_policy_table,
      (select count(*)::integer from pg_class c join pg_namespace n
        on n.oid = c.relnamespace where n.nspname = 'momi_preorder'
        and c.relname in ('configuration_item_policies',
          'configuration_price_classes') and c.relrowsecurity)
        as policy_rls_count,
      (select count(*)::integer from pg_class c join pg_namespace n
        on n.oid = c.relnamespace where n.nspname = 'momi_preorder'
        and c.relname in ('commands', 'public_request_rate_buckets',
          'checkout_holds', 'orders') and c.relrowsecurity) as rls_count,
      has_function_privilege('service_role',
        'momi_preorder.create_order_intent_v1(jsonb,text)', 'execute')
        as service_entry,
      has_function_privilege('anon',
        'momi_preorder.create_order_intent_v1(jsonb,text)', 'execute')
        as anon_entry,
      has_function_privilege('service_role',
        'momi_preorder.authority_hash_v1(text)', 'execute') as service_helper,
      has_function_privilege('service_role',
        'momi_preorder.item_eligible_on_v1(boolean,text,date,date,date)',
        'execute') as service_policy_helper`;
  assert.deepEqual(security, {
    anon_table: false,
    authenticated_table: false,
    anon_policy_table: false,
    service_policy_table: false,
    policy_rls_count: 2,
    rls_count: 4,
    service_entry: true,
    anon_entry: false,
    service_helper: false,
    service_policy_helper: false,
  });
}
