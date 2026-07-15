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
    select event.source_occurred_at, event.received_at,
      subscription.observed_freshness_window
    into strict webhook_event
    from toast_raw.webhook_events as event
    join toast_raw.webhook_subscriptions as subscription
      using (subscription_key)
    where event.event_guid = split_part(p_source_version_id, ':', 2)
      and event.subscription_key = 'orders';
    source_occurred_at := webhook_event.source_occurred_at;
    emitted_event_name := case when source_occurred_at between
      webhook_event.received_at - webhook_event.observed_freshness_window
      and webhook_event.received_at + webhook_event.observed_freshness_window
      then 'warehouse.order.observed'
      else 'warehouse.order.reconciled' end;
  elsif p_observation_key like 'toast:resource-observation:%' then
    select job.mode into acquisition_mode
    from toast_raw.resource_observations as observation
    join toast_raw.api_request_attempts as attempt using (attempt_id)
    join toast_acquisition.jobs as job using (job_id)
    where observation.observation_id = split_part(
      p_observation_key, ':', 3
    )::bigint;
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
  canonical_document := jsonb_strip_nulls(jsonb_build_object(
    'id', order_entity_id,
    'location_id', location_entity_id,
    'channel', case jsonb_typeof(source_order.payload -> 'source')
      when 'string' then source_order.payload -> 'source'
      when 'object' then to_jsonb(source_order.payload #>> '{source,name}')
      else null end,
    'approval_status', source_order.payload ->> 'approvalStatus',
    'voided', source_order.payload -> 'voided',
    'business_date', source_order.payload ->> 'businessDate',
    'opened_at', source_order.payload ->> 'openedDate',
    'closed_at', source_order.payload ->> 'closedDate',
    'guest_count', source_order.payload -> 'numberOfGuests',
    'presentation', source_order.order_presentation
  ));
  version_id := warehouse_projection.record_entity_version(
    order_entity_id, canonical_document, 'order', source_order.order_id,
    source_order.source_version_id, source_occurred_at,
    jsonb_build_object(
      'source_system', 'toast', 'resource_type', 'order',
      'source_id', source_order.order_id,
      'source_version_id', source_order.source_version_id,
      'source_content_hash', source_order.content_hash,
      'acquisition_mode', acquisition_mode,
      'source_observation_key', p_observation_key,
      'observed_at', source_occurred_at
    ), p_observation_key, p_correlation_id
  );
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id,
    occurred_at, schema_version, source_system, source_resource_type,
    source_id, source_reference, correlation_id
  ) values (
    emitted_event_name, 'warehouse:order:' || version_id,
    'order', order_entity_id, source_occurred_at, 1,
    'toast', 'order', source_order.order_id,
    jsonb_build_object(
      'schema', 'momi_warehouse', 'table', 'entity_versions',
      'id', version_id
    ), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected';
end;
$$;

revoke all on function warehouse_projection.project_toast_order(
  text, text, uuid
) from public, anon, authenticated;
