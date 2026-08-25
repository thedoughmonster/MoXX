-- service-owner: momi-event-routing

create function momi_events.wake_event_router()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare route_path text; project_url text; gateway_key text;
begin
  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.events.route.http.v1'
    and registry.function_key = 'momi.events.route.v1'
    and registry.route_path = '/functions/v1/momi-event-router-v1'
    and registry.http_method = 'POST' and registry.active;
  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'event_id', new.event_id,
      'capability_token', new.capability_token
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger wake_event_router
after insert or update of status, capability_token
on momi_events.routing_work
for each row
when (new.status in ('pending', 'retry_wait'))
execute function momi_events.wake_event_router();

select cron.schedule(
  'momi-event-routing-wakeup-v1',
  '* * * * *',
  $$
    update momi_events.routing_work
    set capability_token = gen_random_uuid(),
        status = case
          when attempt_count >= 12 then 'dead_letter'
          else 'retry_wait'
        end,
        next_attempt_at = now(),
        lease_expires_at = null,
        last_error = case
          when status = 'running' then coalesce(last_error, 'worker lease expired')
          else last_error
        end
    where event_id in (
      select event_id from momi_events.routing_work
      where (
        status in ('pending', 'retry_wait') and next_attempt_at <= now()
      ) or (
        status = 'running' and lease_expires_at <= now()
      )
      order by next_attempt_at limit 100 for update skip locked
    )
  $$
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-event-routing-wakeup-v1';

revoke all on function momi_events.wake_event_router()
  from public, anon, authenticated;
