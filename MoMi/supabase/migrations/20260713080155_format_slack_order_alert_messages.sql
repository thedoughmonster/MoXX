drop view momi_alerting.slack_order_alert_messages_v1;

create view momi_alerting.slack_order_alert_messages_v1
with (security_invoker = true)
as
with base as (
  select work.id as delivery_work_id, work.idempotency_key,
    candidate.id as candidate_id, candidate.destination_key,
    candidate.order_presentation as presentation,
    destination.is_enabled as destination_enabled,
    destination.slack_channel_id
  from momi_alerting.slack_delivery_work as work
  join momi_alerting.order_alert_candidates as candidate
    on candidate.id = work.candidate_id
  join momi_alerting.slack_destinations as destination
    on destination.destination_key = candidate.destination_key
), item_lines as (
  select base.delivery_work_id, item.ordinality as item_index,
    format('*%sx %s*%s', coalesce(item.value ->> 'quantity', '1'),
      replace(replace(replace(coalesce(item.value ->> 'name',
        'Unnamed item'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
      coalesce(modifiers.mrkdwn, '')) as raw_mrkdwn,
    format('%sx %s%s', coalesce(item.value ->> 'quantity', '1'),
      coalesce(item.value ->> 'name', 'Unnamed item'),
      coalesce(modifiers.plain, '')) as raw_plain
  from base
  cross join lateral jsonb_array_elements(
    coalesce(base.presentation -> 'items', '[]'::jsonb)
  ) with ordinality as item(value, ordinality)
  left join lateral (
    select string_agg(format(E'\n%s- %sx %s',
        repeat('  ', greatest(1, least(8,
          coalesce((modifier.value ->> 'depth')::integer, 1)))),
        coalesce(modifier.value ->> 'quantity', '1'),
        replace(replace(replace(coalesce(modifier.value ->> 'name',
          'Unnamed modifier'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')),
        '' order by modifier.ordinality) as mrkdwn,
      string_agg(format(E'\n%s- %sx %s',
        repeat('  ', greatest(1, least(8,
          coalesce((modifier.value ->> 'depth')::integer, 1)))),
        coalesce(modifier.value ->> 'quantity', '1'),
        coalesce(modifier.value ->> 'name', 'Unnamed modifier')),
        '' order by modifier.ordinality) as plain
    from jsonb_array_elements(
      coalesce(item.value -> 'modifiers', '[]'::jsonb)
    ) with ordinality as modifier(value, ordinality)
  ) as modifiers on true
  where item.ordinality <= 46
), item_blocks as (
  select delivery_work_id,
    jsonb_agg(jsonb_build_object('type', 'section', 'text',
      jsonb_build_object('type', 'mrkdwn', 'verbatim', true, 'text',
        case when length(raw_mrkdwn) <= 2900 then raw_mrkdwn
          else left(raw_mrkdwn, 2840)
            || E'\n- Additional modifiers retained in MoMi' end))
      order by item_index) as blocks,
    string_agg(raw_plain, E'\n' order by item_index) as fallback_items
  from item_lines
  group by delivery_work_id
), prepared as (
  select base.*,
    coalesce(nullif(base.presentation ->> 'source_label', ''), 'Order')
      as source_label,
    coalesce(nullif(base.presentation ->> 'display_number', ''), 'Unnumbered')
      as display_number,
    coalesce(base.presentation ->> 'item_count', '0') as item_count,
    case when base.presentation ->> 'total_amount' is null then 'Not provided'
      else base.presentation ->> 'total_amount'
        || coalesce(' ' || nullif(base.presentation ->> 'currency_code', ''), '')
      end as total_text,
    case when base.presentation ->> 'fulfillment_epoch' is null
      then 'Not provided'
      else format('<!date^%s^{date_short_pretty} at {time}|%s>',
        base.presentation ->> 'fulfillment_epoch',
        coalesce(base.presentation ->> 'fulfillment_at', 'Scheduled time'))
      end as fulfillment_text,
    item_blocks.blocks as item_blocks,
    item_blocks.fallback_items
  from base
  left join item_blocks using (delivery_work_id)
)
select delivery_work_id, candidate_id, destination_key,
  destination_enabled, slack_channel_id,
  jsonb_build_object(
    'channel', slack_channel_id,
    'client_msg_id', idempotency_key::text,
    'text', left(format(E'New %s order #%s\nItems: %s\nTotal: %s\n%s',
      source_label, display_number, item_count, total_text,
      coalesce(fallback_items, 'No readable line items were provided.')), 4000),
    'mrkdwn', false,
    'unfurl_links', false,
    'unfurl_media', false,
    'blocks', jsonb_build_array(
      jsonb_build_object('type', 'header', 'text', jsonb_build_object(
        'type', 'plain_text', 'emoji', true, 'text',
        left(format('New %s order #%s', source_label, display_number), 150))),
      jsonb_build_object('type', 'section', 'fields', jsonb_build_array(
        jsonb_build_object('type', 'mrkdwn', 'text',
          format('*Items*\n%s', item_count)),
        jsonb_build_object('type', 'mrkdwn', 'text',
          format('*Total*\n%s', total_text)),
        jsonb_build_object('type', 'mrkdwn', 'verbatim', true, 'text',
          format('*Fulfillment*\n%s', fulfillment_text)))),
      jsonb_build_object('type', 'divider')
    ) || coalesce(item_blocks, jsonb_build_array(jsonb_build_object(
      'type', 'section', 'text', jsonb_build_object('type', 'plain_text',
        'text', 'No readable line items were provided.'))))
    || case when (presentation ->> 'item_count')::numeric > 46
      then jsonb_build_array(jsonb_build_object('type', 'context',
        'elements', jsonb_build_array(jsonb_build_object('type', 'plain_text',
          'text', format('%s additional line items are retained in MoMi.',
            (presentation ->> 'item_count')::numeric - 46)))))
      else '[]'::jsonb end
  ) as message_payload
from prepared;

revoke all on table momi_alerting.slack_order_alert_messages_v1
  from public, anon, authenticated;
