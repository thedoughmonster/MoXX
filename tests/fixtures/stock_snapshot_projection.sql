create schema extensions;
create extension pgcrypto with schema extensions;
create schema toast_raw;
create schema toast_acquisition;
create schema warehouse_projection;
create schema momi_warehouse;
create schema momi_events;

create table toast_raw.api_request_attempts (
  attempt_id uuid primary key, job_id bigint, started_at timestamptz,
  finished_at timestamptz, http_status integer, response_json jsonb
);
create table toast_raw.resource_versions (
  resource_version_id uuid primary key, resource_type text, payload jsonb
);
create table toast_raw.resource_observations (
  observation_id bigint primary key, resource_version_id uuid,
  attempt_id uuid, correlation_id uuid
);
create table toast_acquisition.jobs (
  job_id bigint primary key, operation_key text, status text, mode text,
  restaurant_guid text
);
create table momi_warehouse.stock_observations (
  snapshot_id uuid, source_observation_key text unique, item_entity_id uuid,
  location_entity_id uuid, observed_at timestamptz, stock_state text,
  quantity numeric, source_system text, source_reference jsonb,
  correlation_id uuid
);
create table momi_warehouse.menu_universe_versions (
  universe_version_id uuid primary key, source_system text,
  source_location_id text
);
create table momi_warehouse.menu_universe_observations (
  universe_version_id uuid, observed_at timestamptz, observation_id bigint
);
create table momi_warehouse.menu_universe_items (
  universe_version_id uuid, item_entity_id uuid
);
create table momi_events.events (
  event_id uuid primary key default extensions.gen_random_uuid(),
  idempotency_key text not null unique, event_name text not null,
  entity_type text, entity_id uuid, occurred_at timestamptz not null,
  schema_version integer not null, source_system text,
  source_resource_type text, source_id text, source_reference jsonb,
  correlation_id uuid not null
);
create table warehouse_projection.projection_calls (observation_id bigint);

create function warehouse_projection.resolve_source_entity(
  text, text, text, text, text, timestamptz
) returns uuid language sql immutable set search_path = '' as $$
  select '00000000-0000-0000-0000-000000000401'::uuid
$$;
create function warehouse_projection.resolve_toast_stock_item(
  text, p_item_guid text, text
) returns uuid language sql immutable set search_path = '' as $$
  select case p_item_guid
    when 'item-a' then '00000000-0000-0000-0000-000000000501'::uuid
    when 'item-b' then '00000000-0000-0000-0000-000000000502'::uuid
    when 'item-c' then '00000000-0000-0000-0000-000000000503'::uuid
  end
$$;
create function warehouse_projection.project_toast_stock_observation(
  p_observation_id bigint, p_correlation_id uuid
) returns text language plpgsql set search_path = '' as $$
declare input record; item_id uuid;
begin
  select * into strict input
  from toast_raw.read_stock_snapshot_observations_v1(1)
  where observation_id = p_observation_id;
  insert into warehouse_projection.projection_calls values (p_observation_id);
  if input.item_guid_validity <> 'VALID' then return 'ignored_invalid'; end if;
  item_id := warehouse_projection.resolve_toast_stock_item(
    'location-a', input.item_guid, input.multi_location_id);
  if item_id is null then return 'ignored_unmapped'; end if;
  insert into momi_warehouse.stock_observations values (
    null, 'toast:resource-observation:' || p_observation_id, item_id,
    '00000000-0000-0000-0000-000000000401', '2026-08-24 03:00Z',
    'OUT_OF_STOCK', null, 'toast', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', p_observation_id, 'job_id', 1, 'observation_kind', 'explicit'
    ), p_correlation_id
  ) on conflict (source_observation_key) do nothing;
  return 'projected_stock_observation';
end
$$;

insert into toast_acquisition.jobs values
  (1, 'toast.stock.snapshot.v1', 'succeeded', 'snapshot', 'location-a'),
  (2, 'toast.orders.v1', 'succeeded', 'snapshot', 'location-a'),
  (3, 'toast.stock.snapshot.v1', 'running', 'snapshot', 'location-a');
insert into toast_raw.api_request_attempts values
  ('00000000-0000-0000-0000-000000000101', 1, '2026-08-24 01:00Z',
    '2026-08-24 02:00Z', 200, '[]'),
  ('00000000-0000-0000-0000-000000000102', 1, '2026-08-24 02:00Z',
    '2026-08-24 03:00Z', 200, '[]'),
  ('00000000-0000-0000-0000-000000000103', 1, '2026-08-24 03:00Z',
    '2026-08-24 04:00Z', 500, '[]');
insert into toast_raw.resource_versions values
  ('00000000-0000-0000-0000-000000000201', 'stock_state',
    '{"guid":"item-a"}'),
  ('00000000-0000-0000-0000-000000000202', 'stock_state',
    '{"guid":"item-b"}'),
  ('00000000-0000-0000-0000-000000000203', 'stock_state',
    '{"guid":"item-c","itemGuidValidity":"INVALID"}');
insert into toast_raw.resource_observations values
  (1, '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000301'),
  (2, '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000302'),
  (3, '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000303');
insert into momi_warehouse.menu_universe_versions values
  ('00000000-0000-0000-0000-000000000601', 'toast', 'location-a');
insert into momi_warehouse.menu_universe_observations values
  ('00000000-0000-0000-0000-000000000601', '2026-08-24 02:30Z', 1);
insert into momi_warehouse.menu_universe_items values
  ('00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000502'),
  ('00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000503');
