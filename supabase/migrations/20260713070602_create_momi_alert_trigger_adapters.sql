drop function toast_hydration.wake_order_alert_worker();

create function momi_orders.wake_order_alert_worker()
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
  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.orders.alert_worker.http.v1'
    and registry.function_key = 'momi.orders.alert.evaluate.v1'
    and registry.route_path = '/functions/v1/momi-order-alert-worker-v1'
    and registry.http_method = 'POST'
    and registry.active;

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets
  where name = 'momi_publishable_key';

  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'work_id', new.id::text,
      'trigger_token', new.trigger_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger wake_order_alert_worker
after insert on momi_orders.api_invocation_work
for each row execute function momi_orders.wake_order_alert_worker();

create function momi_alerting.enqueue_slack_order_alert_delivery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into momi_alerting.slack_delivery_work (candidate_id)
  values (new.id)
  on conflict (candidate_id) do nothing;
  return new;
end;
$$;

create trigger enqueue_slack_order_alert_delivery
after insert on momi_alerting.order_alert_candidates
for each row execute function
  momi_alerting.enqueue_slack_order_alert_delivery();
