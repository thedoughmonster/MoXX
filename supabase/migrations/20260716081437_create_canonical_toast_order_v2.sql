-- service-owner: warehouse-projection

create function warehouse_projection.try_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return nullif(btrim(p_value), '')::timestamptz;
exception when others then
  return null;
end;
$$;

create function warehouse_projection.canonical_toast_order_document_v2(
  p_payload jsonb,
  p_order_id uuid,
  p_location_id uuid
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  with source_values as (
    select
      warehouse_projection.try_timestamptz(
        p_payload ->> 'createdDate') as submitted_at,
      warehouse_projection.try_timestamptz(
        p_payload ->> 'openedDate') as opened_at,
      warehouse_projection.try_timestamptz(
        p_payload ->> 'closedDate') as closed_at,
      warehouse_projection.try_timestamptz(
        p_payload ->> 'promisedDate') as promised_at,
      warehouse_projection.try_timestamptz(
        p_payload ->> 'estimatedFulfillmentDate') as estimated_at,
      case jsonb_typeof(p_payload -> 'source')
        when 'string' then p_payload ->> 'source'
        when 'object' then p_payload #>> '{source,name}'
        else null end as source_name
  ), normalized as (
    select source_values.*,
      case
        when promised_at is not null then 'scheduled'
        when nullif(btrim(p_payload ->> 'promisedDate'), '') is not null
          then 'unknown'
        when estimated_at is not null then 'asap'
        else 'unknown'
      end as fulfillment_timing,
      case
        when promised_at is not null then promised_at
        when nullif(btrim(p_payload ->> 'promisedDate'), '') is null
          then estimated_at
        else null
      end as fulfillment_at
    from source_values
  ), presentation as (
    select normalized.*,
      (warehouse_projection.toast_order_presentation_v1(p_payload)
        - 'presentation_version' - 'fulfillment_at' - 'fulfillment_epoch')
      || jsonb_build_object(
         'presentation_version', 2,
         'fulfillment_timing', fulfillment_timing,
         'fulfillment_at', fulfillment_at,
         'fulfillment_epoch', extract(epoch from fulfillment_at)::bigint
       ) as document
    from normalized
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_order_id,
    'location_id', p_location_id,
    'channel_kind', case
      when source_name = 'In Store' then 'in_store'
      when nullif(btrim(source_name), '') is not null then 'out_of_store'
      else 'unknown' end,
    'approval_status', case upper(coalesce(
      p_payload ->> 'approvalStatus', ''))
      when 'APPROVED' then 'approved'
      when 'FUTURE' then 'future'
      when 'PENDING' then 'pending'
      when 'NOT_APPROVED' then 'pending'
      when 'REJECTED' then 'rejected'
      when 'DENIED' then 'rejected'
      else 'unknown' end,
    'voided', case when jsonb_typeof(p_payload -> 'voided') = 'boolean'
      then p_payload -> 'voided' else null end,
    'submitted_at', submitted_at,
    'business_date', nullif(p_payload ->> 'businessDate', ''),
    'opened_at', opened_at,
    'closed_at', closed_at,
    'guest_count', case
      when jsonb_typeof(p_payload -> 'numberOfGuests') = 'number'
        then p_payload -> 'numberOfGuests' else null end,
    'fulfillment', jsonb_build_object(
      'timing', fulfillment_timing, 'at', fulfillment_at
    ),
    'presentation', document
  ))
  from presentation;
$$;

comment on function warehouse_projection.canonical_toast_order_document_v2(
  jsonb, uuid, uuid
) is 'Maps a Toast order into the source-neutral Dough Monster order v2 contract.';

revoke all on function warehouse_projection.try_timestamptz(text)
  from public, anon, authenticated;
revoke all on function
  warehouse_projection.canonical_toast_order_document_v2(jsonb, uuid, uuid)
  from public, anon, authenticated;

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
  insert into momi_events.events (
    event_name, idempotency_key, entity_type, entity_id,
    occurred_at, schema_version, source_system, source_resource_type,
    source_id, source_reference, correlation_id
  ) values (
    emitted_event_name, 'warehouse:order:' || version_id,
    'order', order_entity_id, source_occurred_at, 2,
    'toast', 'order', source_order.order_id,
    jsonb_build_object(
      'schema', 'momi_warehouse',
      'table', 'entity_versions',
      'id', version_id
    ), p_correlation_id
  ) on conflict (idempotency_key) do nothing;
  return 'projected';
end;
$$;

comment on function warehouse_projection.project_toast_order(
  text, text, uuid
) is 'Projects one Toast order through the canonical order v2 adapter.';

revoke all on function warehouse_projection.project_toast_order(
  text, text, uuid
) from public, anon, authenticated;
