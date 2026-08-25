-- service-owner: warehouse-projection

do $$
declare
  target pg_catalog.pg_proc%rowtype;
  target_owner name;
  acl_count bigint;
  cron_count bigint;
begin
  select procedure.* into target
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'warehouse_projection.process_delivery_batch(integer,integer)');
  if not found or target.prokind <> 'p' then
    raise exception 'MOX-188 target procedure is missing';
  end if;
  select role.rolname into target_owner
  from pg_catalog.pg_roles as role
  where role.oid = target.proowner;
  select pg_catalog.count(*) into acl_count
  from pg_catalog.aclexplode(target.proacl) as acl;
  if target_owner <> 'postgres' or target.prosecdef or target.proconfig is not null
    or pg_catalog.md5(target.prosrc) <>
      'edf46bc642f0a92e37ae19addec09a38'
    or acl_count <> 1 or exists (
      select 1 from pg_catalog.aclexplode(target.proacl) as acl
      where acl.grantee <> target.proowner or acl.is_grantable
    )
  then raise exception 'MOX-188 target procedure metadata drifted'; end if;
  select pg_catalog.count(*) into cron_count
  from cron.job as job
  where job.jobname = 'momi-warehouse-projection-database-v1'
    and job.schedule = '3 seconds'
    and job.command =
      'call warehouse_projection.process_delivery_batch(6, 60)';
  if cron_count <> 1 then
    raise exception 'MOX-188 projection cron contract drifted';
  end if;
end;
$$;

create or replace procedure warehouse_projection.process_delivery_batch(
  p_limit integer default 6,
  p_budget_seconds integer default 60
)
language plpgsql
security invoker
as $$
declare
  claimed record;
  failure_state text;
  failure_text text;
  processed integer := 0;
  started_at timestamptz;
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog', true);
  started_at := pg_catalog.clock_timestamp();
  if p_limit < 1 or p_limit > 32
    or p_budget_seconds < 5 or p_budget_seconds > 90
  then raise exception 'projection_batch_envelope_invalid'; end if;
  loop
    exit when processed >= p_limit
      or pg_catalog.clock_timestamp() >= started_at
        + pg_catalog.make_interval(secs => p_budget_seconds);
    select * into claimed from
      warehouse_projection.claim_database_delivery();
    exit when not found;
    commit and chain;
    perform pg_catalog.set_config('search_path', 'pg_catalog', true);
    failure_text := null;
    begin
      perform warehouse_projection.project_and_ack_delivery(
        claimed.event_id, claimed.message_id, claimed.capability_token
      );
    exception when others then
      get stacked diagnostics failure_state = returned_sqlstate,
        failure_text = message_text;
    end;
    if failure_text is not null then
      perform momi_events.fail_delivery(
        'warehouse-projection-toast-v1', claimed.event_id,
        claimed.message_id, claimed.capability_token,
        failure_state || ': ' || failure_text
      );
    end if;
    processed := processed + 1;
    commit and chain;
    perform pg_catalog.set_config('search_path', 'pg_catalog', true);
  end loop;
end;
$$;

do $$
declare
  target pg_catalog.pg_proc%rowtype;
  target_owner name;
  acl_count bigint;
  cron_count bigint;
begin
  select procedure.* into strict target
  from pg_catalog.pg_proc as procedure
  where procedure.oid = pg_catalog.to_regprocedure(
    'warehouse_projection.process_delivery_batch(integer,integer)');
  select role.rolname into strict target_owner
  from pg_catalog.pg_roles as role
  where role.oid = target.proowner;
  select pg_catalog.count(*) into acl_count
  from pg_catalog.aclexplode(target.proacl) as acl;
  select pg_catalog.count(*) into cron_count
  from cron.job as job
  where job.jobname = 'momi-warehouse-projection-database-v1'
    and job.schedule = '3 seconds'
    and job.command =
      'call warehouse_projection.process_delivery_batch(6, 60)';
  if target_owner <> 'postgres' or target.prosecdef or target.proconfig is not null
    or pg_catalog.md5(target.prosrc) <>
      'e3e1e4b28c45d66de115a8bc374e5995'
    or acl_count <> 1 or exists (
      select 1 from pg_catalog.aclexplode(target.proacl) as acl
      where acl.grantee <> target.proowner or acl.is_grantable
    )
    or cron_count <> 1
  then raise exception 'MOX-188 protected procedure contract changed'; end if;
end;
$$;
