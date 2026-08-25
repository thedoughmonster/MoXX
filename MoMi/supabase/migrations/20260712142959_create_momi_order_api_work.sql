create schema if not exists momi_api;

comment on schema momi_api is
  'Private registered read contracts exposed only through the MoMi API.';

revoke all on schema momi_api from public, anon, authenticated;

create table momi_api.read_view_registry (
  view_key text primary key,
  contract_version integer not null,
  schema_name text not null,
  view_or_function_name text not null,
  parameter_contract jsonb not null,
  result_contract jsonb not null,
  active boolean not null default false,
  owner_service text not null,
  created_at timestamptz not null default now(),
  constraint read_view_registry_key_present
    check (nullif(view_key, '') is not null),
  constraint read_view_registry_version_positive
    check (contract_version > 0)
);

create view momi_api.toast_orders_by_guid_v1
with (security_invoker = true)
as
select distinct on (source.requested_order_guid)
  source.requested_order_guid as order_guid,
  source.restaurant_guid,
  source.id as order_version_id,
  source.retrieved_at,
  source.content_hash,
  source.payload
from toast_raw.orders as source
where jsonb_typeof(source.payload) = 'object'
  and source.payload ->> 'guid' = source.requested_order_guid
order by
  source.requested_order_guid,
  source.retrieved_at desc,
  source.id desc;

create table toast_hydration.order_api_invocation_work (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  order_version_id bigint not null unique references toast_raw.orders(id),
  restaurant_guid text not null,
  order_guid text not null,
  api_contract_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_error text,
  constraint order_api_work_contract_present
    check (nullif(api_contract_key, '') is not null),
  constraint order_api_work_status_valid
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  constraint order_api_work_attempt_count_valid
    check (attempt_count >= 0)
);

create index order_api_invocation_work_pending_idx
  on toast_hydration.order_api_invocation_work (created_at)
  where status in ('pending', 'failed');

alter table momi_api.read_view_registry enable row level security;
alter table toast_hydration.order_api_invocation_work enable row level security;

revoke all on table momi_api.read_view_registry
  from public, anon, authenticated;
revoke all on table momi_api.toast_orders_by_guid_v1
  from public, anon, authenticated;
revoke all on table toast_hydration.order_api_invocation_work
  from public, anon, authenticated;
revoke all on sequence toast_hydration.order_api_invocation_work_id_seq
  from public, anon, authenticated;
