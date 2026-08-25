alter schema toast_alerting rename to momi_alerting;

drop view momi_alerting.slack_order_alert_messages_v1;
drop function momi_alerting.claim_hydrated_order_alert_candidates(bigint, jsonb);
drop function momi_alerting.enqueue_slack_order_alert_delivery();
drop function momi_alerting.wake_slack_delivery_worker();

alter table momi_alerting.toast_sources
  rename to order_source_mappings;
alter table momi_alerting.order_source_mappings
  rename column order_guid_path to order_id_path;
alter table momi_alerting.order_source_mappings
  add column source_system text,
  add column api_contract_key text;

update momi_alerting.order_source_mappings
set source_system = 'toast',
    api_contract_key = 'momi.toast_orders.get_by_id.v1';

alter table momi_alerting.order_source_mappings
  alter column source_system set not null,
  alter column api_contract_key set not null;
alter table momi_alerting.order_source_mappings
  rename constraint toast_sources_pkey to order_source_mappings_pkey;
alter table momi_alerting.order_source_mappings
  rename constraint toast_sources_source_key_is_present
    to order_source_mappings_source_key_present;
alter table momi_alerting.order_source_mappings
  rename constraint toast_sources_payload_path_is_present
    to order_source_mappings_payload_path_present;
alter table momi_alerting.order_source_mappings
  rename constraint toast_sources_order_guid_path_is_present
    to order_source_mappings_order_id_path_present;
alter table momi_alerting.order_source_mappings
  rename constraint toast_sources_match_operator_valid
    to order_source_mappings_match_operator_valid;

alter table momi_alerting.order_alert_candidates
  add column source_system text,
  add column api_contract_key text;

update momi_alerting.order_alert_candidates as candidate
set source_system = work.source_system,
    api_contract_key = work.api_contract_key,
    decision_context = candidate.decision_context || jsonb_build_object(
      'source_provenance',
      jsonb_strip_nulls(jsonb_build_object(
        'raw_event_id', candidate.raw_event_id,
        'source_work_kind', work.source_work_kind,
        'source_work_id', work.source_work_id,
        'source_resource_kind', work.source_resource_kind,
        'source_version_id', work.source_version_id
      ))
    )
from momi_orders.api_invocation_work as work
where work.id = candidate.order_api_work_id;

alter table momi_alerting.order_alert_candidates
  drop constraint order_alert_candidates_order_kind_unique,
  drop constraint order_alert_candidates_order_guid_is_present,
  drop constraint order_alert_candidates_raw_event_id_fkey,
  drop constraint order_alert_candidates_hydration_job_id_fkey,
  drop constraint order_alert_candidates_order_version_id_fkey,
  alter column source_system set not null,
  alter column api_contract_key set not null;
alter table momi_alerting.order_alert_candidates
  rename column toast_order_guid to order_id;
alter table momi_alerting.order_alert_candidates
  rename column order_api_work_id to api_work_id;
alter table momi_alerting.order_alert_candidates
  drop column raw_event_id,
  drop column hydration_job_id,
  drop column order_version_id,
  add constraint order_alert_candidates_order_id_present
    check (nullif(order_id, '') is not null),
  add constraint order_alert_candidates_order_kind_unique
    unique (source_system, order_id, alert_kind);

comment on schema momi_alerting is
  'Private source-neutral alert configuration, claims, and delivery work.';
comment on table momi_alerting.order_source_mappings is
  'Contract-specific mappings from complete order payloads to alert sources.';

revoke all on schema momi_alerting from public, anon, authenticated;
revoke all on all tables in schema momi_alerting
  from public, anon, authenticated;
