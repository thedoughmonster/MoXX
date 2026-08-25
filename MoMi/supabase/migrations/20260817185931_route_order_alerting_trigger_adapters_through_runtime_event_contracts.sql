-- service-owner: order-alerting

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
  if not momi_events.authorize_order_alert_delivery_wake_v1(
    new.event_id, new.queue_message_id, new.capability_token
  ) then return new; end if;
  select resolved.route_path into route_path
  from momi_runtime.resolve_order_alert_worker_trigger_v1() as resolved;
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

create or replace function momi_orders.wake_order_alert_worker()
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
  if new.api_contract_key <> 'momi.toast_orders.get_by_id.v1' then
    return new;
  end if;
  select resolved.route_path into route_path
  from momi_runtime.resolve_order_alert_worker_trigger_v1() as resolved;
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
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

drop view momi_alerting.order_event_cutover_readiness_v1;
