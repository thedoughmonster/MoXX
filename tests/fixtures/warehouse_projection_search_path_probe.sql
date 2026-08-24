create schema warehouse_projection;
create schema momi_events;
create schema mox379_probe;
create schema cron;

create table mox379_probe.state (
  claims integer not null,
  projections integer not null,
  observed_paths text[] not null
);
insert into mox379_probe.state values (0, 0, array[]::text[]);

create table cron.job (
  jobname text not null,
  active boolean not null,
  schedule text not null,
  command text not null
);
insert into cron.job values (
  'momi-warehouse-projection-database-v1', false, '3 seconds',
  'call warehouse_projection.process_delivery_batch(6, 60)'
);

create function warehouse_projection.claim_database_delivery()
returns table (event_id uuid, message_id bigint, capability_token uuid)
language plpgsql security invoker as $fn$
declare next_claim integer;
begin
  update mox379_probe.state set observed_paths = pg_catalog.array_append(
    observed_paths, pg_catalog.current_setting('search_path'));
  select claims into next_claim from mox379_probe.state;
  if next_claim = 0 then
    update mox379_probe.state set claims = 1;
    return query values (
      '11111111-1111-1111-1111-111111111111'::uuid,
      7::bigint,
      '22222222-2222-2222-2222-222222222222'::uuid
    );
  end if;
end;
$fn$;

create function warehouse_projection.project_and_ack_delivery(
  uuid, bigint, uuid
)
returns text language plpgsql security invoker as $fn$
begin
  update mox379_probe.state set projections = projections + 1,
    observed_paths = pg_catalog.array_append(
      observed_paths, pg_catalog.current_setting('search_path'));
  return 'projected_probe';
end;
$fn$;

create function momi_events.fail_delivery(text, uuid, bigint, uuid, text)
returns text language sql security invoker set search_path = '' as $fn$
  select 'retry_wait'::text;
$fn$;

__PROCEDURE__

revoke all on procedure
  warehouse_projection.process_delivery_batch(integer, integer)
  from public;
