-- service-owner: toast-webhook-ingestion

create function toast_raw.webhook_headers_are_safe(p_headers jsonb)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_headers) <> 'object' then false
    else not exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_headers) as header(name)
      where pg_catalog.lower(header.name) ~
        '(auth|cookie|credential|session|signature|api[-_]?key|apikey|token|secret)'
    )
  end;
$$;

update toast_raw.order_webhook_events set headers = '{}'::jsonb
where headers <> '{}'::jsonb;
update toast_raw.stock_webhook_events set headers = '{}'::jsonb
where headers <> '{}'::jsonb;
update toast_raw.webhook_events set headers = '{}'::jsonb
where headers <> '{}'::jsonb;

alter table toast_raw.order_webhook_events
  alter column headers set default '{}'::jsonb,
  add constraint order_webhook_events_safe_headers
  check (headers = '{}'::jsonb and toast_raw.webhook_headers_are_safe(headers));
alter table toast_raw.stock_webhook_events
  alter column headers set default '{}'::jsonb,
  add constraint stock_webhook_events_safe_headers
  check (headers = '{}'::jsonb and toast_raw.webhook_headers_are_safe(headers));
alter table toast_raw.webhook_events
  alter column headers set default '{}'::jsonb,
  add constraint webhook_events_safe_headers
  check (headers = '{}'::jsonb and toast_raw.webhook_headers_are_safe(headers));

revoke all on function toast_raw.webhook_headers_are_safe(jsonb)
  from public, anon, authenticated;
