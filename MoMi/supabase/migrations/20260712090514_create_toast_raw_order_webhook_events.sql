create schema if not exists toast_raw;

comment on schema toast_raw is
  'Source-preserving records received directly from Toast.';

revoke all on schema toast_raw from public, anon, authenticated;

create table toast_raw.order_webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  headers jsonb not null,
  payload jsonb not null,
  constraint order_webhook_events_payload_is_object
    check (jsonb_typeof(payload) = 'object'),
  constraint order_webhook_events_event_guid_is_present
    check (nullif(payload ->> 'guid', '') is not null)
);

create unique index order_webhook_events_event_guid_uidx
  on toast_raw.order_webhook_events ((payload ->> 'guid'));

alter table toast_raw.order_webhook_events enable row level security;

revoke all on table toast_raw.order_webhook_events
  from public, anon, authenticated;

revoke all on sequence toast_raw.order_webhook_events_id_seq
  from public, anon, authenticated;

alter default privileges in schema toast_raw
  revoke all on tables from public, anon, authenticated;

alter default privileges in schema toast_raw
  revoke all on sequences from public, anon, authenticated;

comment on table toast_raw.order_webhook_events is
  'Complete Toast order webhook payloads and request headers.';

comment on column toast_raw.order_webhook_events.payload is
  'Unomitted webhook JSON stored without business transformation.';
