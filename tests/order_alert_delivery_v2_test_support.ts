import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

const migrations = new URL("../supabase/migrations/", import.meta.url)
const [binding, wrapper, consumers] = await Promise.all([
  readFile(new URL("20260824141117_add_order_alert_delivery_v2_binding.sql",
    migrations), "utf8"),
  readFile(new URL("20260824141122_issue_order_alert_delivery_v2_bindings.sql",
    migrations), "utf8"),
  readFile(new URL("20260824141129_route_order_reads_through_delivery_v2.sql",
    migrations), "utf8"),
])

export const deliveryDatabaseSetupSql = `
  create extension pgcrypto;
  create role anon; create role authenticated; create role service_role;
  create role svc_order_alerting;
  create schema momi_api; create schema momi_alerting;
  create schema momi_events;
  create table momi_api.read_capabilities (
    id bigint generated always as identity primary key,
    function_key text not null, subject_entity_id uuid not null,
    scope_entity_id uuid, binding_key text not null,
    capability_token uuid not null default gen_random_uuid() unique,
    created_at timestamptz not null default statement_timestamp(),
    expires_at timestamptz not null,
    revoked_at timestamptz, consumed_at timestamptz,
    subject_version_id uuid
  );
  create table momi_alerting.issuer_control (
    mode text not null, function_key text not null,
    subject_id uuid not null, version_id uuid
  );
  insert into momi_alerting.issuer_control values (
    'valid', 'momi.orders.get_by_version.v1',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002');
  create table momi_alerting.issuer_calls (id bigint generated always as identity);
  create function momi_alerting.issue_order_read_capability(
    bigint,bigint,uuid,uuid,bigint,uuid
  ) returns table (read_work_id text, capability_token uuid)
  language plpgsql as $$
  declare control momi_alerting.issuer_control%rowtype;
    issued_id bigint; issued_token uuid;
  begin
    select * into strict control from momi_alerting.issuer_control;
    insert into momi_alerting.issuer_calls default values;
    if control.mode = 'empty' then return; end if;
    insert into momi_api.read_capabilities (
      function_key, subject_entity_id, subject_version_id,
      binding_key, expires_at
    ) values (control.function_key, control.subject_id, control.version_id,
      'momi.order_alert_delivery.v1', statement_timestamp() + interval '30 seconds')
    returning id, momi_api.read_capabilities.capability_token
      into issued_id, issued_token;
    return query select issued_id::text, case when control.mode = 'mismatch'
      then gen_random_uuid() else issued_token end;
  end $$;
  create table momi_events.delivery_witnesses (
    event_id uuid, message_id bigint, delivery_token uuid,
    lease_expires_at timestamptz
  );
  create table momi_events.witness_calls (event_id uuid);
  create function momi_events.acquire_order_alert_delivery_witness_v1(
    p_event_id uuid, p_message_id bigint, p_delivery_token uuid, integer
  ) returns table (lease_expires_at timestamptz)
  language plpgsql as $$ begin
    insert into momi_events.witness_calls values (p_event_id);
    return query select witness.lease_expires_at
    from momi_events.delivery_witnesses as witness
    where witness.event_id = p_event_id
      and witness.message_id = p_message_id
      and witness.delivery_token = p_delivery_token
      and witness.lease_expires_at > statement_timestamp();
  end $$;
  ${binding}
  ${wrapper}
  ${consumers}
`

export async function createDeliveryDatabase(): Promise<PGlite> {
  const database = new PGlite({ extensions: { pgcrypto } })
  await database.exec(deliveryDatabaseSetupSql)
  return database
}
