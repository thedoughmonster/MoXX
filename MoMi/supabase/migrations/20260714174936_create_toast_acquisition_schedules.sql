-- service-owner: toast-data-acquisition

create table toast_acquisition.capture_windows (
  window_key text not null,
  restaurant_guid text not null,
  day_of_week integer not null,
  timezone text not null,
  local_start time not null,
  local_end time not null,
  buffer_before_minutes integer not null,
  buffer_after_minutes integer not null,
  effective_from date not null,
  effective_until date,
  source_kind text not null default 'online_ordering_hours',
  active boolean not null default true,
  primary key (window_key, day_of_week, effective_from),
  constraint capture_windows_day_valid check (day_of_week between 0 and 6),
  constraint capture_windows_buffers_valid check (
    buffer_before_minutes between 0 and 240
    and buffer_after_minutes between 0 and 240
  ),
  constraint capture_windows_dates_valid check (
    effective_until is null or effective_until >= effective_from
  )
);

create table toast_acquisition.capture_window_policies (
  restaurant_guid text not null,
  day_of_week integer not null,
  buffer_before_minutes integer not null,
  buffer_after_minutes integer not null,
  active boolean not null default true,
  primary key (restaurant_guid, day_of_week),
  constraint capture_window_policies_day_valid
    check (day_of_week between 0 and 6),
  constraint capture_window_policies_buffers_valid check (
    buffer_before_minutes between 0 and 240
    and buffer_after_minutes between 0 and 240
  )
);

create table toast_acquisition.schedules (
  schedule_key text primary key,
  operation_key text not null
    references toast_acquisition.operations(operation_key),
  source_key text not null,
  restaurant_guid text not null,
  mode text not null,
  schedule_kind text not null,
  timezone text not null default 'America/New_York',
  interval_seconds integer,
  local_run_time time,
  day_of_month integer,
  window_key text,
  parameter_defaults jsonb not null default '{}'::jsonb,
  window_lookback_seconds integer,
  reason text not null,
  next_due_at timestamptz not null,
  active boolean not null default false,
  constraint schedules_restaurant_fk foreign key (source_key, restaurant_guid)
    references toast_acquisition.restaurants(source_key, restaurant_guid),
  constraint schedules_mode_valid check (
    mode in ('live', 'snapshot', 'backfill', 'repair', 'reconcile')
  ),
  constraint schedules_kind_valid
    check (schedule_kind in ('interval', 'daily', 'monthly')),
  constraint schedules_interval_valid
    check (interval_seconds is null or interval_seconds >= 60),
  constraint schedules_month_day_valid
    check (day_of_month is null or day_of_month between 1 and 28),
  constraint schedules_parameters_object
    check (jsonb_typeof(parameter_defaults) = 'object'),
  constraint schedules_lookback_valid
    check (window_lookback_seconds is null or window_lookback_seconds > 0),
  constraint schedules_cadence_valid check (
    (schedule_kind = 'interval' and interval_seconds is not null)
    or (schedule_kind = 'daily' and local_run_time is not null)
    or (schedule_kind = 'monthly' and local_run_time is not null
      and day_of_month is not null)
  ),
  constraint schedules_reason_present check (nullif(reason, '') is not null)
);

create index schedules_due_idx on toast_acquisition.schedules (
  next_due_at, schedule_key
) where active;
create function toast_acquisition.capture_window_policy_ready(p_restaurant_guid text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select count(*) = 7 from toast_acquisition.capture_window_policies
  where restaurant_guid = p_restaurant_guid and active;
$$;
create function toast_acquisition.assert_capture_window_schedule_ready()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.active and new.window_key is not null then
    perform 1 from toast_acquisition.capture_window_policies where restaurant_guid = new.restaurant_guid for share;
    if not toast_acquisition.capture_window_policy_ready(new.restaurant_guid) then
      raise exception using errcode = '23514', message = 'capture_window_policy_incomplete';
    end if;
    if not exists (select 1 from toast_acquisition.capture_windows where window_key = new.window_key
      and restaurant_guid = new.restaurant_guid and active) then raise exception using errcode = '23514', message = 'capture_window_not_derived'; end if;
  end if;
  return new;
end;
$$;
create trigger assert_capture_window_schedule_ready
before insert or update of active, window_key, restaurant_guid
on toast_acquisition.schedules for each row
execute function toast_acquisition.assert_capture_window_schedule_ready();
alter table toast_acquisition.capture_windows enable row level security;
alter table toast_acquisition.capture_window_policies enable row level security;
alter table toast_acquisition.schedules enable row level security;
revoke all on all tables in schema toast_acquisition
  from public, anon, authenticated;

comment on table toast_acquisition.capture_windows is 'Database-owned capture windows derived from online ordering hours plus buffers.';
comment on table toast_acquisition.capture_window_policies is 'Operator-owned per-day buffers applied to captured online ordering hours.';
revoke all on function toast_acquisition.capture_window_policy_ready(text) from public, anon, authenticated;
revoke all on function toast_acquisition.assert_capture_window_schedule_ready()
  from public, anon, authenticated;
