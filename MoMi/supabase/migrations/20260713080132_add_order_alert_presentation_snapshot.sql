alter table momi_alerting.order_source_mappings
  add column currency_code text,
  add constraint order_source_mappings_currency_code_valid
    check (currency_code is null or currency_code ~ '^[A-Z]{3}$');

comment on column momi_alerting.order_source_mappings.currency_code is
  'Configured ISO 4217 code used only when presenting source amounts.';

alter table momi_alerting.order_alert_candidates
  add column order_presentation jsonb;

update momi_alerting.order_alert_candidates as candidate
set order_presentation = presentation.order_presentation
  || jsonb_strip_nulls(jsonb_build_object(
    'source_label', coalesce(nullif(source.display_name, ''), source.source_key),
    'currency_code', source.currency_code
  ))
from momi_orders.api_invocation_work as work
join momi_api.toast_order_alert_presentations_v1 as presentation
  on presentation.source_version_id = work.source_version_id
cross join momi_alerting.order_source_mappings as source
where work.id = candidate.api_work_id
  and source.source_key = candidate.source_key
  and work.source_system = 'toast';

alter table momi_alerting.order_alert_candidates
  alter column order_presentation set not null,
  add constraint order_alert_candidates_presentation_object
    check (jsonb_typeof(order_presentation) = 'object'),
  add constraint order_alert_candidates_presentation_v1
    check (order_presentation ->> 'presentation_version' = '1'),
  add constraint order_alert_candidates_presentation_items
    check (jsonb_typeof(order_presentation -> 'items') = 'array');

comment on column momi_alerting.order_alert_candidates.order_presentation is
  'Immutable source-neutral order presentation captured when claimed.';

update momi_api.read_view_registry
set result_contract = jsonb_build_object(
  'grain', 'one exact Toast order source version',
  'includes', jsonb_build_array('complete_payload', 'order_presentation.v1')
)
where view_key = 'momi.toast_orders.get_by_id.v1';
