-- service-owner: toast-webhook-ingestion

create table toast_raw.webhook_subscriptions (
  subscription_key text primary key,
  toast_category text not null unique,
  public_route text not null,
  external_subscription_id text,
  subscription_status text not null default 'unconfigured',
  observed_freshness_window interval not null default interval '15 minutes',
  last_verified_at timestamptz,
  constraint webhook_subscription_route_valid
    check (public_route like '/functions/v1/%'),
  constraint webhook_subscription_status_valid check (
    subscription_status in ('unconfigured', 'pending', 'active', 'failed', 'disabled')
  ),
  constraint webhook_subscription_freshness_valid check (
    observed_freshness_window > interval '0 seconds'
  )
);

create table toast_raw.webhook_event_types (
  subscription_key text not null
    references toast_raw.webhook_subscriptions(subscription_key),
  event_category text not null,
  event_type text not null,
  primary key (subscription_key, event_category, event_type)
);

create table toast_raw.webhook_events (
  id bigint generated always as identity primary key,
  event_guid text not null unique,
  subscription_key text not null,
  event_category text not null,
  event_type text not null,
  restaurant_guid text,
  received_at timestamptz not null default now(),
  source_occurred_at timestamptz not null,
  correlation_id uuid not null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  raw_body text,
  raw_body_exact boolean not null default false,
  content_hash text not null,
  handler_version text not null,
  constraint webhook_events_type_fk foreign key (
    subscription_key, event_category, event_type
  ) references toast_raw.webhook_event_types (
    subscription_key, event_category, event_type
  ),
  constraint webhook_events_payload_valid check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'guid' = event_guid
    and payload ->> 'eventCategory' = event_category
    and payload ->> 'eventType' = event_type
    and (payload ->> 'timestamp')::timestamptz = source_occurred_at
  ),
  constraint webhook_events_headers_object
    check (jsonb_typeof(headers) = 'object'),
  constraint webhook_events_hash_valid
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint webhook_events_exact_body_present
    check (not raw_body_exact or raw_body is not null),
  constraint webhook_events_raw_body_hash check (
    raw_body is null or encode(
      extensions.digest(raw_body, 'sha256'), 'hex'
    ) = content_hash
  )
);

create index webhook_events_category_time_idx
  on toast_raw.webhook_events (subscription_key, received_at desc);
create index webhook_events_restaurant_time_idx
  on toast_raw.webhook_events (restaurant_guid, received_at desc)
  where restaurant_guid is not null;

insert into toast_raw.webhook_subscriptions (
  subscription_key, toast_category, public_route, subscription_status
) values
  ('orders', 'orders', '/functions/v1/toast-orders-webhook-ingest-v1', 'active'),
  ('stock', 'stock', '/functions/v1/toast-stock-webhook-ingest-v1', 'active');

insert into toast_raw.webhook_event_types values
  ('orders', 'order_updated', 'order_updated'),
  ('orders', 'channel_order_updated', 'channel_order_updated'),
  ('stock', 'stock', 'in_stock'),
  ('stock', 'stock', 'low_quantity'),
  ('stock', 'stock', 'out_of_stock');

alter table toast_raw.webhook_subscriptions enable row level security;
alter table toast_raw.webhook_event_types enable row level security;
alter table toast_raw.webhook_events enable row level security;
revoke all on all tables in schema toast_raw
  from public, anon, authenticated;
revoke all on all sequences in schema toast_raw
  from public, anon, authenticated;

comment on table toast_raw.webhook_events is
  'Complete authenticated Toast webhooks across all six subscriptions.';
