-- service-owner: toast-data-acquisition
create function toast_acquisition.ordering_schedule_array(p_value jsonb, p_label text)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
begin
  if coalesce(jsonb_typeof(p_value), 'null') <> 'array' then raise exception using errcode = '22023', message = p_label || ' must be an array'; end if;
  if p_label = 'overrides.diningOptionBehavior' and jsonb_array_length(p_value) = 0 then raise exception using errcode = '22023', message = p_label || ' must not be empty'; end if;
  return p_value;
end; $$;
create function toast_acquisition.ordering_schedule_scalar(p_kind text, p_value jsonb)
returns text language plpgsql immutable security invoker set search_path = '' as $$
declare raw_value text; parsed_date date;
begin
  if p_kind = 'time' and jsonb_typeof(p_value) = 'array' then
    if jsonb_array_length(p_value) <> 2 or jsonb_typeof(p_value -> 0) <> 'number' or jsonb_typeof(p_value -> 1) <> 'number' or (p_value ->> 0) !~ '^(0|[1-9][0-9]?)$' or (p_value ->> 1) !~ '^(0|[1-9][0-9]?)$' or (p_value ->> 0)::integer > 23 or (p_value ->> 1)::integer > 59 then raise exception using errcode = '22023', message = 'time array must be [hour,minute]'; end if;
    raw_value := lpad(p_value ->> 0, 2, '0') || ':' || lpad(p_value ->> 1, 2, '0');
  elsif jsonb_typeof(p_value) in ('string', 'number') then raw_value := p_value #>> '{}';
  else raise exception using errcode = '22023', message = p_kind || ' has an invalid JSON type'; end if;
  if p_kind = 'time' and raw_value ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?Z?$' then return trim(trailing 'Z' from raw_value); end if;
  if p_kind = 'date' and jsonb_typeof(p_value) = 'number' and raw_value ~ '^[0-9]{8}$' then parsed_date := to_date(raw_value, 'YYYYMMDD'); if to_char(parsed_date, 'YYYYMMDD') = raw_value then return parsed_date::text; end if; end if;
  if p_kind = 'behavior' and jsonb_typeof(p_value) = 'string' and upper(raw_value) in ('TAKE_OUT', 'DELIVERY') then return upper(raw_value); end if;
  if p_kind = 'day' and jsonb_typeof(p_value) = 'string' and upper(raw_value) = any (array['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']) then return (array_position(array['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'], upper(raw_value)) - 1)::text; end if;
  raise exception using errcode = '22023', message = p_kind || ' has an invalid value';
end; $$;

create function toast_acquisition.sync_online_ordering_hours(
  p_restaurant_guid text, p_schedule jsonb, p_observed_at timestamptz, p_source_kind text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  capture_key text := 'toast:' || p_restaurant_guid || ':online-ordering';
  effective_date date;
  derived_windows jsonb;
  changed integer;
begin
  if coalesce(jsonb_typeof(p_schedule), 'null') <> 'object' then
    raise exception using errcode = '22023', message = 'ordering schedule must be an object';
  end if;
  if coalesce(nullif(p_schedule ->> 'timeZoneId', ''), 'America/New_York') <> 'America/New_York' then
    raise exception using errcode = '22023', message = 'ordering schedule timezone must be America/New_York';
  end if;
  effective_date := (p_observed_at at time zone 'America/New_York')::date;
  with periods as materialized (
    select toast_acquisition.ordering_schedule_scalar('behavior', item -> 'diningOptionBehavior') as behavior,
      toast_acquisition.ordering_schedule_array(item -> 'dayPeriods', 'servicePeriods.dayPeriods') as days
    from jsonb_array_elements(toast_acquisition.ordering_schedule_array(p_schedule -> 'servicePeriods', 'servicePeriods')) as item
  ), period_days as materialized (
    select behavior, toast_acquisition.ordering_schedule_scalar('day', day -> 'day')::integer as day_of_week,
      toast_acquisition.ordering_schedule_array(day -> 'timeRanges', 'servicePeriods.timeRanges') as ranges
    from periods cross join lateral jsonb_array_elements(days) as day
  ), base_ranges as materialized (
    select behavior, day_of_week, toast_acquisition.ordering_schedule_scalar('time', span -> 'start')::time as local_start,
      toast_acquisition.ordering_schedule_scalar('time', span -> 'end')::time as local_end
    from period_days cross join lateral jsonb_array_elements(ranges) as span
  ), override_items as materialized (
    select toast_acquisition.ordering_schedule_scalar('date', item -> 'businessDate')::date as business_date,
      toast_acquisition.ordering_schedule_array(item -> 'diningOptionBehavior', 'overrides.diningOptionBehavior') as behaviors,
      toast_acquisition.ordering_schedule_array(item -> 'timeRanges', 'overrides.timeRanges') as ranges
    from jsonb_array_elements(toast_acquisition.ordering_schedule_array(p_schedule -> 'overrides', 'overrides')) as item
  ), override_behaviors as materialized (
    select business_date, toast_acquisition.ordering_schedule_scalar('behavior', behavior) as behavior, ranges
    from override_items cross join lateral jsonb_array_elements(behaviors) as behavior
  ), override_ranges as materialized (
    select business_date, behavior, toast_acquisition.ordering_schedule_scalar('time', span -> 'start')::time as local_start,
      toast_acquisition.ordering_schedule_scalar('time', span -> 'end')::time as local_end
    from override_behaviors cross join lateral jsonb_array_elements(ranges) as span
  ), override_dates as (
    select distinct business_date from override_behaviors where business_date >= effective_date
  ), effective_ranges as (
    select null::date as business_date, base_ranges.* from base_ranges
    union all select dates.business_date, base_ranges.* from override_dates as dates join base_ranges
      on day_of_week = extract(dow from dates.business_date)
    where not exists (select 1 from override_behaviors as applied
      where applied.business_date = dates.business_date and applied.behavior = base_ranges.behavior)
    union all select business_date, behavior, extract(dow from business_date)::integer, local_start, local_end
      from override_ranges where business_date >= effective_date
  ), daily as (
    select business_date, day_of_week, min(extract(epoch from local_start)::integer) as start_second,
      max(extract(epoch from local_end)::integer + case when local_end < local_start then 86400 else 0 end) as end_second
    from effective_ranges group by business_date, day_of_week
  ), bounded as (
    select business_date, day_of_week, time '00:00' + make_interval(secs => start_second % 86400) as local_start,
      time '00:00' + make_interval(secs => end_second % 86400) as local_end from daily
  ), boundaries as (
    select effective_date as segment_start union select business_date + 1 from override_dates
  ), segments as (
    select segment_start, lead(segment_start) over (order by segment_start) - 2 as segment_end from boundaries
  ), windows as (
    select day_of_week, local_start, local_end, segment_start as effective_from, segment_end as effective_until
    from bounded cross join segments where business_date is null and (segment_end is null or segment_start <= segment_end)
    union all select day_of_week, local_start, local_end, business_date, business_date from bounded where business_date is not null
  ) select coalesce(jsonb_agg(to_jsonb(windows) order by effective_from, day_of_week), '[]') into derived_windows from windows;
  perform 1 from toast_acquisition.capture_window_policies
    where restaurant_guid = p_restaurant_guid for share;
  if not toast_acquisition.capture_window_policy_ready(p_restaurant_guid) then
    raise exception using errcode = '23514', message = 'capture_window_policy_missing';
  end if;
  update toast_acquisition.capture_windows set active = false,
    effective_until = case when effective_from < effective_date
      then least(coalesce(effective_until, effective_date - 1), effective_date - 1) else effective_until end
  where window_key = capture_key and active;
  insert into toast_acquisition.capture_windows (window_key, restaurant_guid,
    day_of_week, timezone, local_start, local_end, buffer_before_minutes,
    buffer_after_minutes, effective_from, effective_until, source_kind, active
  ) select capture_key, p_restaurant_guid, derived.day_of_week, 'America/New_York', derived.local_start, derived.local_end,
    policy.buffer_before_minutes, policy.buffer_after_minutes, derived.effective_from,
    derived.effective_until, p_source_kind, true
  from jsonb_to_recordset(derived_windows) as derived(day_of_week integer, local_start time, local_end time,
    effective_from date, effective_until date)
  join toast_acquisition.capture_window_policies policy on
    policy.restaurant_guid = p_restaurant_guid and policy.day_of_week = derived.day_of_week and policy.active
  on conflict (window_key, day_of_week, effective_from) do update set timezone = excluded.timezone,
    local_start = excluded.local_start, local_end = excluded.local_end,
    buffer_before_minutes = excluded.buffer_before_minutes, buffer_after_minutes = excluded.buffer_after_minutes,
    effective_until = excluded.effective_until, source_kind = excluded.source_kind, active = true;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function toast_acquisition.ordering_schedule_array(jsonb, text) from public, anon, authenticated;
revoke all on function toast_acquisition.ordering_schedule_scalar(text, jsonb) from public, anon, authenticated;
revoke all on function toast_acquisition.sync_online_ordering_hours(text, jsonb, timestamptz, text) from public, anon, authenticated;
