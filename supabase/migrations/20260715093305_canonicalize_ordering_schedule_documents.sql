-- service-owner: warehouse-projection
create function warehouse_projection.toast_schedule_time(p_value jsonb)
returns text language plpgsql immutable strict parallel safe security invoker
set search_path = '' as $$
declare raw_value text;
begin
  if jsonb_typeof(p_value) = 'array' then
    if jsonb_array_length(p_value) <> 2
      or (p_value ->> 0) !~ '^(0|[1-9][0-9]?)$'
      or (p_value ->> 1) !~ '^(0|[1-9][0-9]?)$'
      or (p_value ->> 0)::integer > 23
      or (p_value ->> 1)::integer > 59 then
      raise exception using errcode = '22023', message = 'invalid schedule time';
    end if;
    raw_value := lpad(p_value ->> 0, 2, '0') || ':'
      || lpad(p_value ->> 1, 2, '0');
  elsif jsonb_typeof(p_value) = 'string' then
    raw_value := trim(trailing 'Z' from p_value #>> '{}');
  end if;
  if raw_value !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?$'
  then raise exception using errcode = '22023', message = 'invalid schedule time';
  end if;
  return to_char(raw_value::time, 'HH24:MI:SS');
end; $$;

create function warehouse_projection.toast_schedule_date(p_value jsonb)
returns text language plpgsql immutable strict parallel safe security invoker
set search_path = '' as $$
declare raw_value text := p_value #>> '{}'; parsed date;
begin
  if raw_value ~ '^[0-9]{8}$' then
    parsed := to_date(raw_value, 'YYYYMMDD');
    if to_char(parsed, 'YYYYMMDD') <> raw_value then parsed := null; end if;
  elsif raw_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    parsed := raw_value::date;
    if parsed::text <> raw_value then parsed := null; end if;
  end if;
  if parsed is null then
    raise exception using errcode = '22023', message = 'invalid schedule date';
  end if;
  return parsed::text;
end; $$;

create function warehouse_projection.toast_schedule_day(p_value text)
returns integer language plpgsql immutable strict parallel safe security invoker
set search_path = '' as $$
declare result integer;
begin
  result := array_position(array['SUNDAY','MONDAY','TUESDAY','WEDNESDAY',
    'THURSDAY','FRIDAY','SATURDAY'], upper(p_value)) - 1;
  if result is null then
    raise exception using errcode = '22023', message = 'invalid schedule day';
  end if;
  return result;
end; $$;

create function warehouse_projection.toast_fulfillment_mode(p_value text)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select case upper(p_value)
    when 'TAKE_OUT' then 'pickup' when 'DELIVERY' then 'delivery'
    else 'other' end;
$$;

create function warehouse_projection.canonical_toast_ordering_schedule_document(
  p_payload jsonb, p_entity_id uuid, p_location_id uuid)
returns jsonb language plpgsql immutable strict parallel safe security invoker
set search_path = '' as $$
declare weekly jsonb; exceptions jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'schedule must be an object';
  end if;
  with periods as (
    select warehouse_projection.toast_fulfillment_mode(service.item ->> 'diningOptionBehavior') mode,
      warehouse_projection.toast_schedule_day(day.item ->> 'day') day_of_week,
      warehouse_projection.toast_schedule_time(span.item -> 'start') local_start,
      warehouse_projection.toast_schedule_time(span.item -> 'end') local_end
    from jsonb_array_elements(coalesce(p_payload -> 'servicePeriods', '[]')) service(item)
    cross join lateral jsonb_array_elements(service.item -> 'dayPeriods') day(item)
    cross join lateral jsonb_array_elements(day.item -> 'timeRanges') span(item)
  ) select coalesce(jsonb_agg(jsonb_build_object('fulfillment_mode', mode,
      'day_of_week', day_of_week, 'local_start', local_start, 'local_end', local_end,
      'ends_next_day', local_end::time < local_start::time)
    order by day_of_week, mode, local_start, local_end), '[]') into weekly from periods;
  with items as (
    select item, warehouse_projection.toast_schedule_date(item -> 'businessDate') local_date
    from jsonb_array_elements(coalesce(p_payload -> 'overrides', '[]')) item
  ) select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'local_date', local_date, 'description', item ->> 'description',
      'fulfillment_modes', (select coalesce(jsonb_agg(
        warehouse_projection.toast_fulfillment_mode(value) order by value), '[]')
        from jsonb_array_elements_text(item -> 'diningOptionBehavior')),
      'closed', jsonb_array_length(item -> 'timeRanges') = 0,
      'periods', (select coalesce(jsonb_agg(jsonb_build_object(
        'local_start', warehouse_projection.toast_schedule_time(span -> 'start'),
        'local_end', warehouse_projection.toast_schedule_time(span -> 'end'),
        'ends_next_day', warehouse_projection.toast_schedule_time(span -> 'end')::time
          < warehouse_projection.toast_schedule_time(span -> 'start')::time)), '[]')
        from jsonb_array_elements(item -> 'timeRanges') span)
    )) order by local_date), '[]') into exceptions from items;
  return jsonb_strip_nulls(jsonb_build_object(
    'id', p_entity_id, 'entity_type', 'schedule', 'location_id', p_location_id,
    'schedule_kind', 'online_ordering', 'timezone', nullif(p_payload ->> 'timeZoneId', ''),
    'accepts_scheduled_orders', p_payload -> 'acceptScheduledOrders',
    'scheduled_order_horizon_days', p_payload -> 'scheduledOrderMaxDays',
    'last_order_acceptance_policy', case p_payload ->> 'lastOrderConfiguration'
      when 'UNTIL_CLOSING_TIME' then 'closing_time'
      when 'UNTIL_PREPTIME_CUTOFF' then 'preparation_cutoff' end,
    'weekly_periods', weekly, 'date_exceptions', exceptions));
end; $$;

revoke all on function warehouse_projection.toast_schedule_time(jsonb),
  warehouse_projection.toast_schedule_date(jsonb),
  warehouse_projection.toast_schedule_day(text),
  warehouse_projection.toast_fulfillment_mode(text),
  warehouse_projection.canonical_toast_ordering_schedule_document(jsonb, uuid, uuid)
  from public, anon, authenticated;
