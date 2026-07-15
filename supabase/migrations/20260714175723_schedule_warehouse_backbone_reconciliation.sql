-- service-owner: toast-data-acquisition

create table toast_acquisition.raw_processing_failures (
  failure_id bigint generated always as identity primary key,
  source_table text not null, source_record_id text not null,
  processing_stage text not null, restaurant_guid text,
  error_sqlstate text not null, error_message text not null,
  failed_at timestamptz not null default now()
);
create index raw_processing_failures_source_idx on
  toast_acquisition.raw_processing_failures (source_table, source_record_id);
alter table toast_acquisition.raw_processing_failures enable row level security;
revoke all on table toast_acquisition.raw_processing_failures
  from public, anon, authenticated;
revoke all on sequence toast_acquisition.raw_processing_failures_failure_id_seq
  from public, anon, authenticated;
create function toast_acquisition.capture_window_is_open(
  p_window_key text,
  p_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_window_key is null or exists (
    select 1
    from toast_acquisition.capture_windows as capture_window
    cross join lateral (
      select p_at at time zone capture_window.timezone as local_at
    ) as observed
    cross join lateral (values (-1), (0), (1)) as candidate(day_offset)
    where capture_window.window_key = p_window_key and capture_window.active
      and extract(dow from (
        observed.local_at::date + candidate.day_offset
      )) = capture_window.day_of_week
      and observed.local_at::date + candidate.day_offset
        >= capture_window.effective_from
      and (capture_window.effective_until is null
        or observed.local_at::date + candidate.day_offset
          <= capture_window.effective_until)
      and observed.local_at between
        observed.local_at::date + candidate.day_offset
          + capture_window.local_start
          - make_interval(mins => capture_window.buffer_before_minutes)
        and observed.local_at::date + candidate.day_offset
          + capture_window.local_end
          + case when capture_window.local_end < capture_window.local_start
            then interval '1 day' else interval '0 days' end
          + make_interval(mins => capture_window.buffer_after_minutes)
  );
$$;
create function toast_acquisition.enqueue_due_schedules(p_limit integer default 200)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  due toast_acquisition.schedules;
  enqueued integer := 0;
  due_at timestamptz;
  local_now timestamp;
  inserted boolean;
begin
  for due in
    select * from toast_acquisition.schedules
    where active and next_due_at <= now()
    order by next_due_at, schedule_key
    for update skip locked
    limit greatest(1, least(p_limit, 500))
  loop
    due_at := due.next_due_at;
    inserted := false;
    if toast_acquisition.capture_window_is_open(due.window_key, now()) then
      insert into toast_acquisition.jobs (
        operation_key, source_key, restaurant_guid, mode,
        window_start, window_end, parameters, reason,
        correlation_id, idempotency_key
      ) values (
        due.operation_key, due.source_key, due.restaurant_guid, due.mode,
        case when due.window_lookback_seconds is null then null
          else now() - make_interval(secs => due.window_lookback_seconds) end,
        case when due.window_lookback_seconds is null then null else now() end,
        due.parameter_defaults, due.reason, gen_random_uuid(),
        due.schedule_key || ':' || to_char(due_at at time zone 'UTC', 'YYYYMMDDHH24MISS')
      ) on conflict (idempotency_key) do nothing;
      if found then
        enqueued := enqueued + 1;
        inserted := true;
      end if;
    end if;
    if inserted or due.window_lookback_seconds is not null then
      local_now := now() at time zone due.timezone;
      update toast_acquisition.schedules
      set next_due_at = case due.schedule_kind
        when 'interval' then now() + make_interval(secs => due.interval_seconds)
        when 'daily' then (local_now::date + 1 + due.local_run_time)
          at time zone due.timezone
        else (date_trunc('month', local_now) + interval '1 month'
          + make_interval(days => due.day_of_month - 1) + due.local_run_time)
          at time zone due.timezone
      end where schedule_key = due.schedule_key;
    end if;
  end loop;
  return enqueued;
end;
$$;

select cron.schedule(
  'momi-toast-acquisition-due-v1',
  '* * * * *',
  'select toast_acquisition.enqueue_due_schedules()'
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-toast-acquisition-due-v1';

revoke all on function toast_acquisition.capture_window_is_open(text, timestamptz)
  from public, anon, authenticated;
revoke all on function toast_acquisition.enqueue_due_schedules(integer) from public, anon, authenticated;
