-- service-owner: momi-event-routing

create function momi_events.append_event_v1(
  p_event_name text,
  p_schema_version integer,
  p_idempotency_key text,
  p_occurred_at timestamptz,
  p_source_system text,
  p_source_resource_type text,
  p_source_id text,
  p_source_reference jsonb,
  p_correlation_id uuid
)
returns table (disposition text, event_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  inserted_id uuid;
  existing momi_events.events%rowtype;
begin
  if nullif(p_event_name, '') is null or length(p_event_name) > 160
    or p_event_name !~ '^(source\.[a-z0-9_]+\.[a-z0-9_.]+|warehouse\.[a-z0-9_.]+)$'
    or p_schema_version <> 1
    or nullif(p_idempotency_key, '') is null or length(p_idempotency_key) > 512
    or p_occurred_at is null
    or nullif(p_source_system, '') is null or length(p_source_system) > 80
    or nullif(p_source_resource_type, '') is null or length(p_source_resource_type) > 160
    or nullif(p_source_id, '') is null or length(p_source_id) > 256
    or p_correlation_id is null
    or jsonb_typeof(p_source_reference) <> 'object'
    or pg_column_size(p_source_reference) > 16384
    or exists (
      select 1 from jsonb_each(p_source_reference) item
      where length(item.key) > 80
        or jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
        or (jsonb_typeof(item.value) = 'string' and length(item.value #>> '{}') > 512)
    ) then
    raise exception 'event append input is invalid' using errcode = '22023';
  end if;
  insert into momi_events.events (
    idempotency_key, event_name, occurred_at, schema_version,
    source_system, source_resource_type, source_id, source_reference,
    correlation_id
  ) values (
    p_idempotency_key, p_event_name, p_occurred_at, p_schema_version,
    p_source_system, p_source_resource_type, p_source_id,
    p_source_reference, p_correlation_id
  ) on conflict (idempotency_key) do nothing
  returning momi_events.events.event_id into inserted_id;
  if inserted_id is not null then
    disposition := 'stored'; event_id := inserted_id; return next; return;
  end if;
  select * into existing from momi_events.events
  where idempotency_key = p_idempotency_key;
  if not found or existing.event_name <> p_event_name
    or existing.schema_version <> p_schema_version
    or existing.occurred_at <> p_occurred_at
    or existing.source_system is distinct from p_source_system
    or existing.source_resource_type is distinct from p_source_resource_type
    or existing.source_id is distinct from p_source_id
    or existing.source_reference <> p_source_reference
    or existing.correlation_id <> p_correlation_id then
    raise exception 'event append replay conflicts' using errcode = '23505';
  end if;
  disposition := 'duplicate'; event_id := existing.event_id; return next;
end;
$$;

comment on function momi_events.append_event_v1(
  text, integer, text, timestamptz, text, text, text, jsonb, uuid
) is 'Append one immutable producer-defined event reference; routing remains asynchronous.';

revoke all on function momi_events.append_event_v1(
  text, integer, text, timestamptz, text, text, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function momi_events.append_event_v1(
  text, integer, text, timestamptz, text, text, text, jsonb, uuid
) to service_role;
