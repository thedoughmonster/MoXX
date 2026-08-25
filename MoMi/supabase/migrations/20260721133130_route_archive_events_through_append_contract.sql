-- service-owner: communications-archive

create or replace function momi_events.emit_toast_webhook_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  event_name text;
begin
  event_name := case new.subscription_key
    when 'orders' then 'source.toast.webhook.orders.observed'
    when 'stock' then 'source.toast.webhook.stock.observed'
    when 'menus' then 'source.toast.webhook.menus.observed'
    when 'packaging' then 'source.toast.webhook.packaging.observed'
    when 'restaurant-availability' then 'source.toast.webhook.restaurant_availability.observed'
    when 'ordering-schedule' then 'source.toast.webhook.ordering_schedule.observed'
    else null
  end;
  if event_name is null then
    raise exception 'unregistered Toast webhook event name' using errcode = '22023';
  end if;
  perform appended.event_id from momi_events.append_event_v1(
    event_name, 1, 'toast:webhook:' || new.event_guid,
    new.source_occurred_at, 'toast', 'webhook.' || new.subscription_key,
    new.event_guid, jsonb_build_object(
      'schema', 'toast_raw', 'table', 'webhook_events', 'id', new.id
    ), new.correlation_id
  ) appended;
  return new;
end;
$$;

create or replace function momi_events.emit_toast_resource_observation()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  source_version toast_raw.resource_versions;
  event_name text;
begin
  select * into strict source_version from toast_raw.resource_versions
  where resource_version_id = new.resource_version_id;
  if source_version.resource_type = 'stock_state' then return new; end if;
  event_name := case source_version.resource_type
    when 'alternate_payment_type' then 'source.toast.resource.alternate_payment_type.observed'
    when 'break_type' then 'source.toast.resource.break_type.observed'
    when 'cash_deposit' then 'source.toast.resource.cash_deposit.observed'
    when 'cash_drawer' then 'source.toast.resource.cash_drawer.observed'
    when 'cash_entry' then 'source.toast.resource.cash_entry.observed'
    when 'device' then 'source.toast.resource.device.observed'
    when 'dining_option' then 'source.toast.resource.dining_option.observed'
    when 'discount' then 'source.toast.resource.discount.observed'
    when 'employee' then 'source.toast.resource.employee.observed'
    when 'job' then 'source.toast.resource.job.observed'
    when 'kitchen_fulfillment' then 'source.toast.resource.kitchen_fulfillment.observed'
    when 'menu' then 'source.toast.resource.menu.observed'
    when 'menu_configuration' then 'source.toast.resource.menu_configuration.observed'
    when 'menu_group' then 'source.toast.resource.menu_group.observed'
    when 'menu_item' then 'source.toast.resource.menu_item.observed'
    when 'menu_metadata' then 'source.toast.resource.menu_metadata.observed'
    when 'modifier_group' then 'source.toast.resource.modifier_group.observed'
    when 'no_sale_reason' then 'source.toast.resource.no_sale_reason.observed'
    when 'order' then 'source.toast.resource.order.observed'
    when 'ordering_schedule' then 'source.toast.resource.ordering_schedule.observed'
    when 'packaging' then 'source.toast.resource.packaging.observed'
    when 'payment' then 'source.toast.resource.payment.observed'
    when 'payout_reason' then 'source.toast.resource.payout_reason.observed'
    when 'pre_modifier' then 'source.toast.resource.pre_modifier.observed'
    when 'pre_modifier_group' then 'source.toast.resource.pre_modifier_group.observed'
    when 'prep_station' then 'source.toast.resource.prep_station.observed'
    when 'price_group' then 'source.toast.resource.price_group.observed'
    when 'printer' then 'source.toast.resource.printer.observed'
    when 'restaurant' then 'source.toast.resource.restaurant.observed'
    when 'restaurant_availability' then 'source.toast.resource.restaurant_availability.observed'
    when 'restaurant_service' then 'source.toast.resource.restaurant_service.observed'
    when 'revenue_center' then 'source.toast.resource.revenue_center.observed'
    when 'sales_category' then 'source.toast.resource.sales_category.observed'
    when 'service_area' then 'source.toast.resource.service_area.observed'
    when 'service_charge' then 'source.toast.resource.service_charge.observed'
    when 'shift' then 'source.toast.resource.shift.observed'
    when 'table' then 'source.toast.resource.table.observed'
    when 'tax_rate' then 'source.toast.resource.tax_rate.observed'
    when 'time_entry' then 'source.toast.resource.time_entry.observed'
    when 'tip_withholding' then 'source.toast.resource.tip_withholding.observed'
    when 'void_reason' then 'source.toast.resource.void_reason.observed'
    else null
  end;
  if event_name is null then
    raise exception 'unregistered Toast resource event name' using errcode = '22023';
  end if;
  perform appended.event_id from momi_events.append_event_v1(
    event_name, 1, 'toast:resource-observation:' || new.observation_id,
    new.observed_at, 'toast', source_version.resource_type,
    source_version.source_id, jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', new.observation_id, 'resource_version_id', new.resource_version_id
    ), new.correlation_id
  ) appended;
  return new;
end;
$$;

revoke all on function momi_events.emit_toast_webhook_event()
  from public, anon, authenticated;
revoke all on function momi_events.emit_toast_resource_observation()
  from public, anon, authenticated;
