import assert from "node:assert/strict";

import type { Sql } from "postgres";

const captureSignature = "momi_communications.capture_raw_json_evidence_v1(" +
  "text,text,text,text,text,text,timestamptz,jsonb,jsonb,text,text,text,text)";

export async function assertSecurity(sql: Sql): Promise<void> {
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction.unsafe("set local role anon");
      await transaction`select * from momi_communications.archive_items limit 1`;
    }),
    /permission denied/,
  );

  const [security] = await sql<{
    anon_archive: boolean;
    authenticated_sources: boolean;
    rls_count: number;
    service_capture: boolean;
    anon_capture: boolean;
    authenticated_capture: boolean;
  }[]>`
    select
      has_table_privilege('anon', 'momi_communications.archive_items', 'select')
        as anon_archive,
      has_table_privilege('authenticated', 'momi_communications.source_types',
        'select') as authenticated_sources,
      (select count(*)::integer from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'momi_communications'
          and class.relname in ('source_types', 'archive_items')
          and class.relrowsecurity) as rls_count,
      has_function_privilege('service_role', ${captureSignature}, 'execute')
        as service_capture,
      has_function_privilege('anon', ${captureSignature}, 'execute')
        as anon_capture,
      has_function_privilege('authenticated', ${captureSignature}, 'execute')
        as authenticated_capture`;
  assert.deepEqual(security, {
    anon_archive: false,
    authenticated_sources: false,
    rls_count: 2,
    service_capture: true,
    anon_capture: false,
    authenticated_capture: false,
  });
}
