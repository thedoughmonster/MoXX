-- service-owner: warehouse-projection

create function warehouse_projection.wake_projection_worker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path text;
  project_url text;
  gateway_key text;
  capability_token text;
begin
  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.warehouse_projection.toast.http.v1'
    and registry.function_key = 'momi.warehouse_projection.toast.consume.v1'
    and registry.route_path = '/functions/v1/momi-warehouse-projection-worker-v1'
    and registry.http_method = 'POST'
    and registry.authentication_policy_key = 'durable.work_token.v1'
    and registry.active;
  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  capability_token := to_jsonb(new) ->> 'capability_token';
  if route_path is null or project_url is null
    or gateway_key is null or capability_token is null
    or new.queue_message_id is null then return new; end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'event_id', new.event_id,
      'message_id', new.queue_message_id::text,
      'capability_token', capability_token
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger wake_warehouse_projection_worker
after insert or update of status, queue_message_id
on momi_events.deliveries
for each row
when (
  new.subscription_key = 'warehouse-projection-toast-v1'
  and new.status = 'queued'
)
execute function warehouse_projection.wake_projection_worker();

select cron.schedule(
  'momi-warehouse-projection-wakeup-v1',
  '* * * * *',
  $$
    update momi_events.deliveries
    set status = status
    where subscription_key = 'warehouse-projection-toast-v1'
      and status = 'queued'
      and event_id in (
        select event_id from momi_events.deliveries
        where subscription_key = 'warehouse-projection-toast-v1'
          and status = 'queued'
        order by next_attempt_at limit 1
      )
  $$
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-warehouse-projection-wakeup-v1';

revoke all on function warehouse_projection.wake_projection_worker()
  from public, anon, authenticated;
