-- service-owner: warehouse-projection

create or replace function warehouse_projection.project_toast_event(
  p_event_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_event momi_events.events;
  webhook toast_raw.webhook_events;
  observation toast_raw.resource_observations;
  source_version toast_raw.resource_versions;
  selected_operation_key text;
begin
  select * into strict source_event from momi_events.events
  where event_id = p_event_id;
  if source_event.event_name not like 'source.toast.%' then
    raise exception 'Event % is not a Toast source event', p_event_id;
  end if;
  if source_event.source_reference ->> 'table' = 'webhook_events' then
    select * into strict webhook from toast_raw.webhook_events
    where id = (source_event.source_reference ->> 'id')::bigint;
    if webhook.subscription_key = 'orders' then
      return warehouse_projection.project_toast_order(
        'webhook:' || webhook.event_guid, 'toast:event:' || p_event_id,
        source_event.correlation_id
      );
    end if;
    if webhook.subscription_key = 'stock' then
      return warehouse_projection.project_toast_stock_webhook(
        webhook.id, source_event.correlation_id
      );
    end if;
    if webhook.subscription_key = 'menus' then
      return toast_acquisition.enqueue_menu_publication(
        webhook.restaurant_guid,
        webhook.payload #>> '{details,publishedDate}',
        'menus_webhook', source_event.correlation_id,
        'Menu webhook publication advanced'
      );
    end if;
    selected_operation_key := case webhook.subscription_key
      when 'packaging' then 'toast.packaging.snapshot.v1'
      when 'restaurant-availability' then 'toast.availability.snapshot.v1'
      when 'ordering-schedule' then 'toast.ordering_schedule.snapshot.v1'
      else null end;
    if selected_operation_key is null then return 'ignored_unknown_webhook'; end if;
    insert into toast_acquisition.jobs (
      operation_key, source_key, restaurant_guid, mode,
      reason, correlation_id, idempotency_key
    )
    select selected_operation_key, restaurant.source_key,
      webhook.restaurant_guid, 'live',
      'Webhook reconciliation: ' || webhook.subscription_key,
      source_event.correlation_id,
      'toast:webhook-reconcile:' || webhook.event_guid || ':'
        || selected_operation_key
    from toast_acquisition.restaurants as restaurant
    join toast_acquisition.operations as operation
      on operation.operation_key = selected_operation_key and operation.is_enabled
    where restaurant.restaurant_guid = webhook.restaurant_guid
      and restaurant.is_enabled
    on conflict (idempotency_key) do nothing;
    return case when found
      then 'acquisition_enqueued' else 'acquisition_already_enqueued' end;
  end if;
  if source_event.source_reference ->> 'table' = 'jobs' then
    return warehouse_projection.project_toast_daily_stock_snapshot(
      (source_event.source_reference ->> 'id')::bigint,
      source_event.correlation_id
    );
  end if;
  if source_event.source_reference ->> 'table' = 'resource_observations' then
    select * into strict observation from toast_raw.resource_observations
    where observation_id =
      (source_event.source_reference ->> 'id')::bigint;
    select * into strict source_version from toast_raw.resource_versions
    where resource_version_id = observation.resource_version_id;
    if source_version.resource_type = 'menu' then
      return warehouse_projection.project_toast_menu_document(
        observation.observation_id, source_event.correlation_id
      );
    end if;
    if source_version.resource_type = 'stock_state' then
      return warehouse_projection.project_toast_stock_observation(
        observation.observation_id, source_event.correlation_id
      );
    end if;
    if source_version.resource_type = 'order' then
      return warehouse_projection.project_toast_archived_order(
        observation.observation_id,
        source_event.correlation_id
      );
    end if;
    return warehouse_projection.project_toast_resource_observation(
      observation.observation_id, source_event.correlation_id
    );
  end if;
  return 'ignored_unknown_source_reference';
end;
$$;

revoke all on function warehouse_projection.project_toast_event(uuid)
  from public, anon, authenticated;
