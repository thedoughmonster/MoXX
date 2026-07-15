-- service-owner: toast-data-acquisition
create function toast_acquisition.capture_first_business_date()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  first_date text := coalesce(
    nullif(new.payload #>> '{general,firstBusinessDate}', ''),
    nullif(new.payload ->> 'firstBusinessDate', ''));
  parsed_date date;
begin
  if new.resource_type = 'restaurant' and first_date is not null then
    parsed_date := to_date(first_date, 'YYYYMMDD');
    if first_date !~ '^[0-9]{8}$'
      or to_char(parsed_date, 'YYYYMMDD') <> first_date then
      raise exception 'Invalid firstBusinessDate: %', first_date
        using errcode = '22007';
    end if;
    update toast_acquisition.restaurants set first_business_date = parsed_date
    where restaurant_guid = new.restaurant_guid;
  end if;
  return new;
exception when others then
  begin
    insert into toast_acquisition.raw_processing_failures (
      source_table, source_record_id, processing_stage, restaurant_guid,
      error_sqlstate, error_message
    ) values ('toast_raw.resource_versions', new.resource_version_id::text,
      'capture_first_business_date', new.restaurant_guid, sqlstate, sqlerrm
    );
  exception when others then null;
  end;
  return new;
end;
$$;
create trigger capture_toast_first_business_date after insert
on toast_raw.resource_versions for each row
execute function toast_acquisition.capture_first_business_date();
create function toast_acquisition.enqueue_historical_backfill(
  p_restaurant_guid text, p_through_date date default current_date)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare
  source_key text; first_date date; acquisition_active boolean;
  inserted_count integer := 0; affected integer;
begin
  select restaurant.source_key, restaurant.first_business_date, exists (
    select 1 from toast_acquisition.schedules as schedule
    where schedule.source_key = restaurant.source_key
      and schedule.restaurant_guid = p_restaurant_guid and schedule.active
  ) into source_key, first_date, acquisition_active
  from toast_acquisition.restaurants as restaurant
  where restaurant.restaurant_guid = p_restaurant_guid
    and restaurant.is_enabled;
  if first_date is null then raise exception
    'firstBusinessDate is not available for %', p_restaurant_guid; end if;
  if p_through_date < first_date then raise exception
    'Backfill end precedes firstBusinessDate'; end if;
  with month_windows as (
    select month_start::date,
      least((month_start + interval '1 month')::date, p_through_date + 1) as month_end,
      row_number() over (order by month_start) as sequence
    from generate_series(date_trunc('month', first_date::timestamp),
      date_trunc('month', p_through_date::timestamp), interval '1 month') month_start
  ), planned as (
    select operation_key, month_start, month_end, sequence
    from month_windows cross join (values ('toast.orders.bulk.v1'),
      ('toast.labor.shifts.v1'), ('toast.labor.time_entries.v1')
    ) as operation(operation_key)
  )
  insert into toast_acquisition.jobs (
    operation_key, source_key, restaurant_guid, mode,
    window_start, window_end, parameters, reason,
    correlation_id, idempotency_key, next_attempt_at
  )
  select operation_key, source_key, p_restaurant_guid, 'backfill',
    greatest(month_start, first_date)::timestamp at time zone 'America/New_York',
    month_end::timestamp at time zone 'America/New_York',
    case when operation_key = 'toast.labor.time_entries.v1'
      then '{"includeMissedBreaks":true}'::jsonb else '{}'::jsonb end,
    'Historical exit archive backfill', gen_random_uuid(),
    operation_key || ':' || p_restaurant_guid || ':' || month_start,
    case when acquisition_active then now() + make_interval(secs => sequence::integer) else 'infinity'::timestamptz end
  from planned on conflict (idempotency_key) do nothing;
  get diagnostics affected = row_count;
  inserted_count := inserted_count + affected;
  with days as (
    select business_date::date,
      row_number() over (order by business_date) as sequence
    from generate_series(first_date, p_through_date, interval '1 day') business_date
  ), planned as (
    select operation_key, selector, business_date, sequence
    from days cross join (values ('toast.payments.list.v1', 'paidBusinessDate'),
      ('toast.payments.list.v1', 'refundBusinessDate'),
      ('toast.payments.list.v1', 'voidBusinessDate'),
      ('toast.cash.entries.v1', null), ('toast.cash.deposits.v1', null),
      ('toast.kitchen.fulfillments.v1', null)
    ) as operation(operation_key, selector)
  )
  insert into toast_acquisition.jobs (
    operation_key, source_key, restaurant_guid, mode,
    window_start, window_end, parameters, reason,
    correlation_id, idempotency_key, next_attempt_at
  )
  select operation_key, source_key, p_restaurant_guid, 'backfill',
    business_date::timestamp at time zone 'America/New_York',
    (business_date + 1)::timestamp at time zone 'America/New_York',
    case when selector is null then '{}'::jsonb
      else jsonb_build_object('date_selector', selector) end,
    'Historical exit archive backfill', gen_random_uuid(),
    operation_key || ':' || coalesce(selector, 'default') || ':'
      || p_restaurant_guid || ':' || business_date,
    case when acquisition_active then now() + make_interval(secs => sequence::integer + 60) else 'infinity'::timestamptz end
  from planned on conflict (idempotency_key) do nothing;
  get diagnostics affected = row_count;
  return inserted_count + affected;
end;
$$;
revoke all on function toast_acquisition.capture_first_business_date() from public, anon, authenticated;
revoke all on function toast_acquisition.enqueue_historical_backfill(text, date) from public, anon, authenticated;
