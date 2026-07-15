-- service-owner: order-alerting

with field_paths(source_field, canonical_path) as (
  values
    ('source', array['channel']::text[]),
    ('approvalStatus', array['approval_status']::text[]),
    ('voided', array['voided']::text[]),
    ('businessDate', array['business_date']::text[]),
    ('openedDate', array['opened_at']::text[]),
    ('closedDate', array['closed_at']::text[]),
    ('numberOfGuests', array['guest_count']::text[]),
    ('displayNumber', array['presentation', 'display_number']::text[]),
    ('promisedDate', array['presentation', 'fulfillment_at']::text[]),
    ('estimatedFulfillmentDate',
      array['presentation', 'fulfillment_at']::text[]),
    ('eventType', array['event_name']::text[])
)
update momi_alerting.order_source_mappings as mapping
set canonical_payload_path = field.canonical_path,
    canonical_expected_value = case
      when field.source_field = 'eventType'
        then to_jsonb('warehouse.order.observed'::text)
      else mapping.expected_value
    end
from field_paths as field
where mapping.payload_path[array_length(mapping.payload_path, 1)]
  = field.source_field;

with field_paths(source_field, canonical_path) as (
  values
    ('source', array['channel']::text[]),
    ('approvalStatus', array['approval_status']::text[]),
    ('voided', array['voided']::text[]),
    ('businessDate', array['business_date']::text[]),
    ('openedDate', array['opened_at']::text[]),
    ('closedDate', array['closed_at']::text[]),
    ('numberOfGuests', array['guest_count']::text[]),
    ('displayNumber', array['presentation', 'display_number']::text[]),
    ('promisedDate', array['presentation', 'fulfillment_at']::text[]),
    ('estimatedFulfillmentDate',
      array['presentation', 'fulfillment_at']::text[]),
    ('eventType', array['event_name']::text[])
)
update momi_alerting.alert_rule_conditions as condition
set canonical_payload_path = field.canonical_path,
    canonical_expected_value = case
      when field.source_field = 'eventType'
        then to_jsonb('warehouse.order.observed'::text)
      else condition.expected_value
    end
from field_paths as field
where condition.payload_path[array_length(condition.payload_path, 1)]
  = field.source_field;

comment on column
  momi_alerting.order_source_mappings.canonical_payload_path is
  'Configured path in the canonical order decision document.';
comment on column
  momi_alerting.alert_rule_conditions.canonical_payload_path is
  'Configured condition path in the canonical order decision document.';
