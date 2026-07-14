-- service-owner: toast-stock-ingest

create table toast_raw.stock_webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  headers jsonb not null,
  payload jsonb not null,
  constraint stock_webhook_events_payload_is_object
    check (jsonb_typeof(payload) = 'object'),
  constraint stock_webhook_events_event_guid_is_present
    check (nullif(payload ->> 'guid', '') is not null),
  constraint stock_webhook_events_event_category_is_stock
    check (payload ->> 'eventCategory' = 'stock'),
  constraint stock_webhook_events_event_type_is_supported
    check ((payload ->> 'eventType') in (
      'in_stock',
      'low_quantity',
      'out_of_stock'
    ))
);

create unique index stock_webhook_events_event_guid_uidx
  on toast_raw.stock_webhook_events ((payload ->> 'guid'));

alter table toast_raw.stock_webhook_events enable row level security;

revoke all on table toast_raw.stock_webhook_events
  from public, anon, authenticated;

revoke all on sequence toast_raw.stock_webhook_events_id_seq
  from public, anon, authenticated;

comment on table toast_raw.stock_webhook_events is
  'Complete Toast stock webhook payloads and request headers.';

comment on column toast_raw.stock_webhook_events.payload is
  'Unomitted stock webhook JSON stored without business transformation.';
