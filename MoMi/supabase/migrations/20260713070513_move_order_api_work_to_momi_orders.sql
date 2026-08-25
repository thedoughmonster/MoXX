create schema momi_orders;

comment on schema momi_orders is
  'Private source-neutral work for owned order API calls.';

alter table toast_hydration.order_api_invocation_work
  set schema momi_orders;
alter table momi_orders.order_api_invocation_work
  rename to api_invocation_work;
alter table toast_hydration.order_api_invocation_attempts
  set schema momi_orders;
alter table momi_orders.order_api_invocation_attempts
  rename to api_invocation_attempts;

alter sequence momi_orders.order_api_invocation_work_id_seq
  rename to api_invocation_work_id_seq;
alter sequence momi_orders.order_api_invocation_attempts_id_seq
  rename to api_invocation_attempts_id_seq;
alter index momi_orders.order_api_invocation_work_claim_idx
  rename to api_invocation_work_claim_idx;
alter index momi_orders.order_api_invocation_attempts_work_idx
  rename to api_invocation_attempts_work_idx;

alter table momi_orders.api_invocation_work
  add column source_system text,
  add column source_work_kind text,
  add column source_work_id text,
  add column source_resource_kind text,
  add column source_version_id text,
  add column location_id text,
  add column order_id text;

update momi_orders.api_invocation_work
set source_system = 'toast',
    source_work_kind = 'order_hydration_job',
    source_work_id = hydration_job_id::text,
    source_resource_kind = 'order',
    source_version_id = order_version_id::text,
    location_id = restaurant_guid,
    order_id = order_guid,
    api_contract_key = 'momi.toast_orders.get_by_id.v1';

alter table momi_orders.api_invocation_work
  alter column source_system set not null,
  alter column source_work_kind set not null,
  alter column source_work_id set not null,
  alter column source_resource_kind set not null,
  alter column source_version_id set not null,
  alter column location_id set not null,
  alter column order_id set not null,
  drop constraint order_api_invocation_work_order_version_id_fkey,
  drop constraint order_api_invocation_work_order_version_id_key,
  drop constraint order_api_work_hydration_job_fk,
  drop column order_version_id,
  drop column restaurant_guid,
  drop column order_guid,
  drop column hydration_job_id,
  add constraint api_invocation_work_source_version_unique
    unique (
      source_system,
      source_resource_kind,
      source_version_id,
      api_contract_key
    );

update toast_hydration.order_hydration_jobs
set downstream_api_contract_key = 'momi.toast_orders.get_by_id.v1'
where downstream_api_contract_key = 'momi.orders.get_by_guid.v1';

update toast_hydration.webhook_order_mappings
set downstream_api_contract_key = 'momi.toast_orders.get_by_id.v1'
where downstream_api_contract_key = 'momi.orders.get_by_guid.v1';

create view momi_api.toast_orders_by_id_v1
with (security_invoker = true)
as
select
  'toast'::text as source_system,
  source.id::text as source_version_id,
  source.restaurant_guid as location_id,
  source.requested_order_guid as order_id,
  source.retrieved_at,
  source.content_hash,
  source.payload
from toast_raw.orders as source
where jsonb_typeof(source.payload) = 'object'
  and source.payload ->> 'guid' = source.requested_order_guid;

drop view momi_api.toast_orders_by_guid_v1;

update momi_api.read_view_registry
set view_key = 'momi.toast_orders.get_by_id.v1',
    view_or_function_name = 'toast_orders_by_id_v1',
    parameter_contract = '{"required":["order_id"],"additionalProperties":false}',
    result_contract = '{"grain":"one exact Toast order source version"}',
    owner_service = 'momi-toast-order-api'
where view_key = 'momi.orders.get_by_guid.v1';

revoke all on schema momi_orders from public, anon, authenticated;
revoke all on all tables in schema momi_orders
  from public, anon, authenticated;
revoke all on table momi_api.toast_orders_by_id_v1
  from public, anon, authenticated;
