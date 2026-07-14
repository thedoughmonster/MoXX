-- service-owner: slack-order-delivery

create or replace view momi_alerting.slack_order_alert_messages_v1
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
    format('%sx %s%s',
      case when jsonb_typeof(item.value -> 'quantity') = 'number'
        then to_char((item.value ->> 'quantity')::numeric,
          'FM999999990.###') else '1' end,
      replace(replace(replace(replace(coalesce(nullif(
        item.value ->> 'name', ''), 'Unnamed item'), '&', '&amp;'),
        '<', '&lt;'), '>', '&gt;'), chr(96), ''''),
      coalesce(E'\n   ' || modifiers.modifier_text, '')) as item_line
  from base
  cross join lateral jsonb_array_elements(
    coalesce(base.presentation -> 'items', '[]'::jsonb)
  ) with ordinality as item(value, ordinality)
  left join lateral (
    select string_agg(case
      when jsonb_typeof(modifier.value -> 'quantity') = 'number'
        and (modifier.value ->> 'quantity')::numeric <> 1
        then to_char((modifier.value ->> 'quantity')::numeric,
          'FM999999990.###') || 'x ' else '' end ||
      replace(replace(replace(replace(coalesce(nullif(
        modifier.value ->> 'name', ''), 'Unnamed modifier'), '&', '&amp;'),
        '<', '&lt;'), '>', '&gt;'), chr(96), ''''),
      ', ' order by modifier.ordinality) as modifier_text
    from jsonb_array_elements(
      coalesce(item.value -> 'modifiers', '[]'::jsonb)
    ) with ordinality as modifier(value, ordinality)
  ) as modifiers on true
), item_text as (
  select delivery_work_id,
    string_agg(item_line, E'\n' order by item_index) as item_text
  from item_lines
  group by delivery_work_id
), prepared as (
  select base.*,
    replace(replace(replace(replace(coalesce(nullif(
      presentation ->> 'display_number', ''), 'Unnumbered'), '&', '&amp;'),
      '<', '&lt;'), '>', '&gt;'), chr(96), '''') as display_number,
    replace(replace(replace(replace(coalesce(nullif(
      presentation ->> 'customer_label', ''), 'Not provided'), '&', '&amp;'),
      '<', '&lt;'), '>', '&gt;'), chr(96), '''') as customer_label,
    replace(replace(replace(replace(coalesce(nullif(
      presentation ->> 'source_label', ''), 'Order'), '&', '&amp;'),
      '<', '&lt;'), '>', '&gt;'), chr(96), '''') as source_label,
    coalesce(presentation ->> 'item_count', '0') as item_count,
    case when presentation ->> 'total_amount' is null then 'Not provided'
      else to_char((presentation ->> 'total_amount')::numeric,
        'FM999999990.00') || coalesce(' ' || nullif(
          presentation ->> 'currency_code', ''), '') end as total_text,
    case when presentation ->> 'fulfillment_at' is null then 'Not provided'
      else to_char((presentation ->> 'fulfillment_at')::timestamp,
        'Mon FMDD at FMHH12:MI AM') end as fulfillment_text,
    coalesce(item_text.item_text,
      'No readable line items were provided.') as item_text
  from base
  left join item_text using (delivery_work_id)
), tickets as (
  select prepared.*, format(E'ORDER #%s\nCUSTOMER: %s\n%s | READY %s\n'
      || E'%s %s | TOTAL %s\n\n%s', display_number, customer_label,
      upper(source_label), fulfillment_text, item_count,
      case when item_count::numeric = 1 then 'ITEM' else 'ITEMS' end,
      total_text, item_text) as ticket_text
  from prepared
)
select delivery_work_id, candidate_id, destination_key,
  destination_enabled, slack_channel_id,
  jsonb_build_object(
    'channel', slack_channel_id,
    'client_msg_id', idempotency_key::text,
    'text', left(ticket_text, 4000),
    'mrkdwn', false,
    'unfurl_links', false,
    'unfurl_media', false,
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'section', 'text', jsonb_build_object(
        'type', 'mrkdwn', 'verbatim', true, 'text',
        format(E'```\n%s\n```', case when length(ticket_text) <= 2880
          then ticket_text else left(ticket_text, 2820)
            || E'\n... Additional details retained in MoMi' end))))
  ) as message_payload
from tickets;

revoke all on table momi_alerting.slack_order_alert_messages_v1
  from public, anon, authenticated;
