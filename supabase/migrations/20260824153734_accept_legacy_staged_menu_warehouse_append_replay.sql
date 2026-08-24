-- service-owner: momi-event-routing
create or replace function momi_events.append_warehouse_event_v1(
  p_event_name text,
  p_schema_version integer,
  p_idempotency_key text,
  p_entity_type text,
  p_entity_id uuid,
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
  v_inserted_id uuid;
  v_existing momi_events.events%rowtype;
  v_entity_version_replay boolean;
begin
  if nullif(p_event_name, '') is null or pg_catalog.length(p_event_name) > 160
    or p_event_name !~ '^warehouse\.[a-z0-9_.]+$'
    or p_schema_version is null or p_schema_version not in (1, 2)
    or nullif(p_idempotency_key, '') is null
    or pg_catalog.length(p_idempotency_key) > 512
    or nullif(p_entity_type, '') is null
    or pg_catalog.length(p_entity_type) > 160
    or p_entity_id is null or p_occurred_at is null
    or nullif(p_source_system, '') is null
    or pg_catalog.length(p_source_system) > 80
    or nullif(p_source_resource_type, '') is null
    or pg_catalog.length(p_source_resource_type) > 160
    or nullif(p_source_id, '') is null
    or pg_catalog.length(p_source_id) > 256
    or p_correlation_id is null or p_source_reference is null
    or pg_catalog.jsonb_typeof(p_source_reference) <> 'object'
    or pg_catalog.pg_column_size(p_source_reference) > 16384
    or exists (
      select 1 from pg_catalog.jsonb_each(p_source_reference) as item
      where pg_catalog.length(item.key) > 80
        or pg_catalog.jsonb_typeof(item.value)
          not in ('string', 'number', 'boolean', 'null')
        or (pg_catalog.jsonb_typeof(item.value) = 'string'
          and pg_catalog.length(item.value #>> '{}') > 512)
    ) then
    raise exception 'warehouse event append input is invalid' using errcode = '22023';
  end if;
  insert into momi_events.events (
    idempotency_key, event_name, entity_type, entity_id, occurred_at,
    schema_version, source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    p_idempotency_key, p_event_name, p_entity_type, p_entity_id,
    p_occurred_at, p_schema_version, p_source_system,
    p_source_resource_type, p_source_id, p_source_reference, p_correlation_id
  ) on conflict (idempotency_key) do nothing
  returning momi_events.events.event_id into v_inserted_id;
  if v_inserted_id is not null then
    disposition := 'stored'; event_id := v_inserted_id; return next; return;
  end if;
  select * into v_existing from momi_events.events
  where idempotency_key = p_idempotency_key;
  v_entity_version_replay := p_idempotency_key like
    'warehouse:entity-version:%'
    and p_event_name = 'warehouse.entity.observed'
    and (
      v_existing.event_name = p_event_name
      or (
        v_existing.event_name = 'warehouse.' || p_entity_type || '.observed'
        and v_existing.event_name <> 'warehouse.menu_entity.observed'
      )
      or (
        v_existing.event_name = 'warehouse.menu_entity.observed'
        and p_entity_type in (
          'menu', 'menu_group', 'menu_item',
          'modifier_group', 'modifier_option'
        )
      )
    );
  if not found
    or (v_existing.event_name is distinct from p_event_name
      and not v_entity_version_replay)
    or v_existing.schema_version is distinct from p_schema_version
    or v_existing.idempotency_key is distinct from p_idempotency_key
    or v_existing.entity_type is distinct from p_entity_type
    or v_existing.entity_id is distinct from p_entity_id
    or (v_existing.occurred_at is distinct from p_occurred_at
      and not v_entity_version_replay)
    or v_existing.source_system is distinct from p_source_system
    or v_existing.source_resource_type is distinct from p_source_resource_type
    or v_existing.source_id is distinct from p_source_id
    or v_existing.source_reference is distinct from p_source_reference
    or (v_existing.correlation_id is distinct from p_correlation_id
      and not v_entity_version_replay) then
    raise exception 'warehouse event append replay conflicts' using errcode = '23505';
  end if;
  disposition := 'duplicate'; event_id := v_existing.event_id; return next;
end;
$$;

comment on function momi_events.append_warehouse_event_v1(
  text, integer, text, text, uuid, timestamptz,
  text, text, text, jsonb, uuid
) is 'Append one immutable warehouse reference; entity-version re-observation preserves the first event metadata, including bounded staged-menu legacy identity.';
