-- service-owner: warehouse-projection

create or replace function warehouse_projection.project_toast_order(
  p_source_version_id text,
  p_observation_key text,
  p_correlation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_order record;
  order_entity_id uuid;
  location_entity_id uuid;
  canonical_document jsonb;
  version_id uuid;
  acquisition_job_id bigint;
  acquisition_mode text;
  emitted_event_name text;
  webhook_event record;
  source_occurred_at timestamptz;
begin
  select * into strict source_order
  from momi_api.toast_orders_by_id_v1
  where source_version_id = p_source_version_id;

  source_occurred_at := source_order.retrieved_at;
  if p_source_version_id like 'webhook:%' then
    select * into strict webhook_event
    from toast_raw.read_order_webhook_projection_input_v1(
      split_part(p_source_version_id, ':', 2)
    );
    source_occurred_at := webhook_event.source_occurred_at;
    emitted_event_name := case when source_occurred_at between
      webhook_event.received_at - webhook_event.observed_freshness_window
      and webhook_event.received_at + webhook_event.observed_freshness_window
      then 'warehouse.order.observed'
      else 'warehouse.order.reconciled' end;
  elsif p_observation_key like 'toast:resource-observation:%' then
    select input.job_id into acquisition_job_id
    from toast_raw.read_resource_projection_input_v1(
      split_part(p_observation_key, ':', 3)::bigint
    ) as input;
    select job.mode into acquisition_mode
    from toast_acquisition.read_projection_job_mode_v1(
      acquisition_job_id
    ) as job;
    emitted_event_name := case when acquisition_mode = 'backfill'
      then 'warehouse.order.archived'
      else 'warehouse.order.reconciled' end;
  else
    emitted_event_name := 'warehouse.order.archived';
  end if;

  location_entity_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '', source_order.location_id,
    source_occurred_at
  );
  order_entity_id := warehouse_projection.resolve_source_entity(
    'order', 'toast', 'order', source_order.location_id,
    source_order.order_id, source_occurred_at
  );
  canonical_document :=
    warehouse_projection.canonical_toast_order_document_v2(
      source_order.payload, order_entity_id, location_entity_id
    );
  version_id := warehouse_projection.record_entity_version(
    order_entity_id, canonical_document, 'order', source_order.order_id,
    source_order.source_version_id, source_occurred_at,
    jsonb_build_object(
      'source_system', 'toast',
      'resource_type', 'order',
      'source_id', source_order.order_id,
      'source_version_id', source_order.source_version_id,
      'source_content_hash', source_order.content_hash,
      'acquisition_mode', acquisition_mode,
      'projection_contract', 'canonical-resource-v2',
      'source_adapter_contract', 'canonical-toast-order-v2',
      'source_observation_key', p_observation_key,
      'observed_at', source_occurred_at
    ), p_observation_key, p_correlation_id
  );
  if emitted_event_name = 'warehouse.order.observed' then
    perform momi_events.append_warehouse_event_v1(
      'warehouse.order.observed', 2, 'warehouse:order:' || version_id,
      'order', order_entity_id, source_occurred_at, 'toast', 'order',
      source_order.order_id, jsonb_build_object(
        'schema', 'momi_warehouse', 'table', 'entity_versions',
        'id', version_id
      ), p_correlation_id
    );
  elsif emitted_event_name = 'warehouse.order.reconciled' then
    perform momi_events.append_warehouse_event_v1(
      'warehouse.order.reconciled', 2, 'warehouse:order:' || version_id,
      'order', order_entity_id, source_occurred_at, 'toast', 'order',
      source_order.order_id, jsonb_build_object(
        'schema', 'momi_warehouse', 'table', 'entity_versions',
        'id', version_id
      ), p_correlation_id
    );
  elsif emitted_event_name = 'warehouse.order.archived' then
    perform momi_events.append_warehouse_event_v1(
      'warehouse.order.archived', 2, 'warehouse:order:' || version_id,
      'order', order_entity_id, source_occurred_at, 'toast', 'order',
      source_order.order_id, jsonb_build_object(
        'schema', 'momi_warehouse', 'table', 'entity_versions',
        'id', version_id
      ), p_correlation_id
    );
  else
    raise exception 'unsupported order event identity' using errcode = '22023';
  end if;
  return 'projected';
end;
$$;

create or replace function warehouse_projection.project_toast_resource_observation(
  p_observation_id bigint,
  p_correlation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  projection_input record;
  entity_type text;
  entity_id uuid;
  location_id uuid;
  canonical_document jsonb;
  provenance jsonb;
  version_id uuid;
  observation_key text;
  projection_contract text;
begin
  select * into strict projection_input
  from toast_raw.read_resource_projection_input_v1(p_observation_id);
  if projection_input.resource_type = 'restaurant'
    and projection_input.first_operation_key = 'toast.restaurants.group.v1'
  then return 'ignored_management_group_reference'; end if;
  if projection_input.resource_type = 'menu' then
    return warehouse_projection.project_toast_menu_document(
      p_observation_id, p_correlation_id);
  elsif projection_input.resource_type = 'stock_state' then
    return warehouse_projection.project_toast_stock_observation(
      p_observation_id, p_correlation_id);
  elsif projection_input.resource_type = 'order' then
    return warehouse_projection.project_toast_archived_order(
      p_observation_id, p_correlation_id);
  end if;

  entity_type := warehouse_projection.canonical_entity_type(
    projection_input.resource_type);
  location_id := warehouse_projection.resolve_source_entity(
    'location', 'toast', 'location', '', projection_input.restaurant_guid,
    projection_input.observed_at);
  if projection_input.resource_type in ('restaurant', 'location') then
    entity_id := location_id;
    perform warehouse_projection.link_source_entity(
      entity_id, 'toast', projection_input.resource_type,
      projection_input.restaurant_guid, projection_input.source_id,
      projection_input.observed_at);
  else
    entity_id := warehouse_projection.resolve_source_entity(
      entity_type, 'toast', projection_input.resource_type,
      projection_input.restaurant_guid, projection_input.source_id,
      projection_input.observed_at);
  end if;

  if projection_input.resource_type = 'ordering_schedule' then
    canonical_document :=
      warehouse_projection.canonical_toast_ordering_schedule_document(
        projection_input.payload, entity_id, location_id);
    projection_contract := 'canonical-ordering-schedule-v1';
    observation_key := 'toast:resource-observation:'
      || projection_input.observation_id || ':ordering-schedule-v1';
  else
    canonical_document :=
      warehouse_projection.canonical_resource_document_v2(
        entity_id, entity_type, location_id,
        projection_input.resource_type, projection_input.payload);
    projection_contract := 'canonical-resource-v2';
    observation_key := 'toast:resource-observation:'
      || projection_input.observation_id || ':canonical-resource-v2';
  end if;
  provenance := jsonb_build_object(
    'source_system', projection_input.source_system,
    'resource_type', projection_input.resource_type,
    'source_id', projection_input.source_id,
    'source_version_id', projection_input.source_version_id,
    'source_content_hash', projection_input.content_hash,
    'projection_contract', projection_contract,
    'source_reference', jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', projection_input.observation_id,
      'resource_version_id', projection_input.resource_version_id),
    'observed_at', projection_input.observed_at);
  version_id := warehouse_projection.record_entity_version(
    entity_id, canonical_document, projection_input.resource_type,
    projection_input.source_id, projection_input.source_version_id,
    projection_input.observed_at, provenance, observation_key, p_correlation_id);
  perform momi_events.append_warehouse_event_v1(
    'warehouse.entity.observed',
    case when projection_contract = 'canonical-resource-v2' then 2 else 1 end,
    'warehouse:entity-version:' || version_id, entity_type, entity_id,
    projection_input.observed_at, projection_input.source_system,
    projection_input.resource_type, projection_input.source_id,
    jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'entity_versions', 'id', version_id
    ), p_correlation_id
  );
  return 'projected';
end;
$$;
