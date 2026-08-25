-- service-owner: warehouse-projection

create function warehouse_projection.wake_next_delivery()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(19482, 1);
  if exists (
    select 1
    from momi_events.deliveries as delivery
    where delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'running'
      and delivery.lease_expires_at > now()
  ) then return false; end if;

  update momi_events.deliveries
  set capability_token = gen_random_uuid()
  where (event_id, subscription_key) in (
    select delivery.event_id, delivery.subscription_key
    from momi_events.deliveries as delivery
    where delivery.subscription_key = 'warehouse-projection-toast-v1'
      and delivery.status = 'queued'
      and delivery.next_attempt_at <= now()
      and delivery.queue_message_id is not null
    order by delivery.next_attempt_at, delivery.event_id
    limit 1 for update skip locked
  );
  return found;
end;
$$;

select cron.alter_job(
  job_id := jobid,
  schedule := '3 seconds',
  command := $command$
    select warehouse_projection.wake_next_delivery()
  $command$,
  active := true
)
from cron.job
where jobname = 'momi-warehouse-projection-wakeup-v1';

do $$
begin
  if (select count(*) from cron.job
    where jobname = 'momi-warehouse-projection-wakeup-v1'
      and active and schedule = '3 seconds'
      and command like '%warehouse_projection.wake_next_delivery()%') <> 1
  then raise exception 'Projection handoff recovery is invalid'; end if;
end;
$$;

revoke all on function warehouse_projection.wake_next_delivery()
  from public, anon, authenticated;
