-- service-owner: order-alerting
-- One capability-fenced wake per queued order-alert delivery.

update momi_runtime.function_registry
set manifest_sha256 =
  '80eb155ff512160dff5b24fcf295563a03592bdf2ceb930f12bab465eedf3d06'
where function_key = 'momi.orders.alert.evaluate.v1'
  and owner_service = 'order-alerting';

update momi_runtime.function_trigger_registry
set authentication_policy_key =
  'momi.order_alert.delivery_capability_or_work_token.v1'
where trigger_key = 'momi.orders.alert_worker.http.v1'
  and function_key = 'momi.orders.alert.evaluate.v1';

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.orders.alert.evaluate.v1', 'event_id', 'event_id',
    'body', false, 'uuid', false, true, 3),
  ('momi.orders.alert.evaluate.v1', 'message_id', 'message_id',
    'body', false, 'string', false, true, 4),
  ('momi.orders.alert.evaluate.v1', 'capability_token', 'capability_token',
    'body', false, 'uuid', false, false, 5)
on conflict (function_key, parameter_key) do update
set required = excluded.required,
    data_type = excluded.data_type,
    store_in_run_log = excluded.store_in_run_log,
    display_order = excluded.display_order;

drop trigger if exists wake_order_alert_event_worker
  on momi_events.deliveries;
drop function if exists
  momi_alerting.ack_order_event_delivery(uuid, bigint);

create or replace function momi_alerting.wake_order_event_worker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path text;
  project_url text;
  gateway_key text;
begin
  if not exists (
    select 1 from momi_events.subscriptions
    where subscription_key = 'order-alerting-v1'
      and event_pattern = 'warehouse.order.observed' and active
  ) then return new; end if;
  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.orders.alert_worker.http.v1'
    and registry.function_key = 'momi.orders.alert.evaluate.v1'
    and registry.route_path = '/functions/v1/momi-order-alert-worker-v1'
    and upper(registry.http_method) = 'POST'
    and registry.authentication_policy_key =
      'momi.order_alert.delivery_capability_or_work_token.v1'
    and registry.active;
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null
    or new.queue_message_id is null or new.capability_token is null
  then return new; end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'event_id', new.event_id,
      'message_id', new.queue_message_id::text,
      'capability_token', new.capability_token
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger wake_order_alert_event_worker
after insert or update of status, queue_message_id, capability_token
on momi_events.deliveries
for each row
when (
  new.subscription_key = 'order-alerting-v1'
  and new.status = 'queued'
  and new.queue_message_id is not null
)
execute function momi_alerting.wake_order_event_worker();

select cron.schedule(
  'momi-order-alert-event-wakeup-v1',
  '* * * * *',
  $$
    update momi_events.deliveries set status = status
    where subscription_key = 'order-alerting-v1' and status = 'queued'
      and event_id in (
        select event_id from momi_events.deliveries
        where subscription_key = 'order-alerting-v1' and status = 'queued'
        order by next_attempt_at limit 100
      )
  $$
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-order-alert-event-wakeup-v1';

revoke all on function momi_alerting.wake_order_event_worker()
  from public, anon, authenticated;
