create schema if not exists toast_hydration;

comment on schema toast_hydration is
  'Private Toast source configuration, hydration work, and attempt records.';

revoke all on schema toast_hydration from public, anon, authenticated;

create table toast_raw.orders (
  id bigint generated always as identity primary key,
  restaurant_guid text not null,
  requested_order_guid text not null,
  source_operation text not null,
  retrieved_at timestamptz not null default now(),
  content_hash text not null,
  payload jsonb not null,
  constraint toast_raw_orders_restaurant_guid_present
    check (nullif(restaurant_guid, '') is not null),
  constraint toast_raw_orders_requested_guid_present
    check (nullif(requested_order_guid, '') is not null),
  constraint toast_raw_orders_source_operation_present
    check (nullif(source_operation, '') is not null),
  constraint toast_raw_orders_content_hash_valid
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint toast_raw_orders_version_unique
    unique (restaurant_guid, requested_order_guid, content_hash)
);

create index toast_raw_orders_current_lookup_idx
  on toast_raw.orders (
    requested_order_guid,
    retrieved_at desc,
    id desc
  );

alter table toast_raw.orders enable row level security;

revoke all on table toast_raw.orders from public, anon, authenticated;
revoke all on sequence toast_raw.orders_id_seq from public, anon, authenticated;

comment on table toast_raw.orders is
  'Immutable, content-deduplicated complete Toast Order resource versions.';

comment on column toast_raw.orders.payload is
  'Complete JSON value returned for one Toast Order resource request.';
