create view momi_alerting.slack_order_alert_messages_v1
with (security_invoker = true)
as
select
  work.id as delivery_work_id,
  candidate.id as candidate_id,
  candidate.source_system,
  candidate.order_id,
  candidate.alert_kind,
  candidate.destination_key,
  destination.is_enabled as destination_enabled,
  destination.slack_channel_id,
  jsonb_build_object(
    'channel', destination.slack_channel_id,
    'client_msg_id', work.idempotency_key::text,
    'text', format(
      E'New %s order\nOrder: %s',
      coalesce(nullif(source.display_name, ''), source.source_key),
      candidate.order_id
    ),
    'mrkdwn', false,
    'unfurl_links', false,
    'unfurl_media', false
  ) as message_payload
from momi_alerting.slack_delivery_work as work
join momi_alerting.order_alert_candidates as candidate
  on candidate.id = work.candidate_id
join momi_alerting.order_source_mappings as source
  on source.source_key = candidate.source_key
join momi_alerting.slack_destinations as destination
  on destination.destination_key = candidate.destination_key;

revoke all on table momi_alerting.slack_order_alert_messages_v1
  from public, anon, authenticated;

create function momi_alerting.wake_slack_delivery_worker()
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
  where registry.trigger_key = 'momi.slack.order_alert.http.v1'
    and registry.function_key = 'momi.slack.order_alert.deliver.v1'
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

create trigger wake_slack_delivery_worker
after insert on momi_alerting.slack_delivery_work
for each row execute function momi_alerting.wake_slack_delivery_worker();
