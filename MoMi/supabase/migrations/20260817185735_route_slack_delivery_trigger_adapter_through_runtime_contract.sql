-- service-owner: slack-order-delivery

create or replace function momi_alerting.wake_slack_delivery_worker()
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
  select resolved.route_path into route_path
  from momi_runtime.resolve_slack_order_delivery_trigger_v1() as resolved;

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
