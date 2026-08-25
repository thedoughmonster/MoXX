create view toast_alerting.slack_order_alert_messages_v1
with (security_invoker = true)
as
select
  work.id as delivery_work_id,
  candidate.id as candidate_id,
  candidate.toast_order_guid as order_guid,
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
      candidate.toast_order_guid
    ),
    'mrkdwn', false,
    'unfurl_links', false,
    'unfurl_media', false
  ) as message_payload
from toast_alerting.slack_delivery_work as work
join toast_alerting.order_alert_candidates as candidate
  on candidate.id = work.candidate_id
join toast_alerting.toast_sources as source
  on source.source_key = candidate.source_key
join toast_alerting.slack_destinations as destination
  on destination.destination_key = candidate.destination_key;

comment on view toast_alerting.slack_order_alert_messages_v1 is
  'Versioned prepared Slack payloads for durable order alert delivery.';

revoke all on table toast_alerting.slack_order_alert_messages_v1
  from public, anon, authenticated;
