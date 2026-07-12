create function toast_alerting.wake_slack_delivery_worker()
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
  from toast_hydration.function_trigger_registry as registry
  where registry.trigger_key = 'toast.slack_order_alert.http.v1'
    and registry.function_key = 'toast.slack_order_alert.deliver.v1'
    and registry.route_path = '/functions/v1/slack-order-alert-delivery-v1'
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

revoke all on function toast_alerting.wake_slack_delivery_worker()
  from public, anon, authenticated;

create trigger wake_slack_delivery_worker
after insert on toast_alerting.slack_delivery_work
for each row execute function toast_alerting.wake_slack_delivery_worker();
