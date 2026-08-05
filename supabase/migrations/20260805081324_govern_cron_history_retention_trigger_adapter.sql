-- service-owner: cron-history-governance

create schema momi_cron_history;

create table momi_cron_history.policy_control (
  singleton boolean primary key default true check (singleton),
  phase text not null default 'disarmed' check (
    phase in ('disarmed', 'dry_run', 'canary', 'drain', 'steady', 'paused')
  ),
  raw_retention interval not null default interval '7 days'
    check (raw_retention = interval '7 days'),
  summary_retention interval not null default interval '90 days'
    check (summary_retention = interval '90 days'),
  exception_retention interval not null default interval '365 days'
    check (exception_retention = interval '365 days'),
  slow_run_threshold interval not null default interval '3 seconds'
    check (slow_run_threshold = interval '3 seconds'),
  batch_size integer not null default 1000 check (batch_size between 1 and 5000),
  accepted_rate_receipt text check (
    accepted_rate_receipt is null or length(accepted_rate_receipt) between 1 and 240
  ),
  order_alert_dlq_ceiling bigint check (order_alert_dlq_ceiling >= 0),
  projection_dlq_ceiling bigint check (projection_dlq_ceiling >= 0),
  dry_run_complete boolean not null default false,
  canary_complete boolean not null default false,
  last_batch_at timestamptz,
  last_stop_reason text check (
    last_stop_reason is null or length(last_stop_reason) <= 160
  ),
  last_error_signature text check (
    last_error_signature is null or length(last_error_signature) <= 80
  ),
  identical_error_count integer not null default 0
    check (identical_error_count between 0 and 2),
  updated_at timestamptz not null default now()
);

insert into momi_cron_history.policy_control (singleton) values (true);

create table momi_cron_history.scan_state (
  singleton boolean primary key default true check (singleton),
  cursor_runid bigint not null default 0 check (cursor_runid >= 0),
  last_high_water_runid bigint not null default 0
    check (last_high_water_runid >= 0),
  updated_at timestamptz not null default now()
);

insert into momi_cron_history.scan_state (singleton) values (true);

create table momi_cron_history.minute_summaries (
  jobid bigint not null,
  minute_bucket timestamptz not null,
  status_class text not null check (
    status_class in ('succeeded', 'failed', 'unexpected')
  ),
  return_class text not null check (
    return_class in (
      'null', 'empty', 'row_count', 'select_count', 'insert_count',
      'update_count', 'delete_count', 'call', 'unknown'
    )
  ),
  run_count bigint not null check (run_count > 0),
  first_runid bigint not null,
  last_runid bigint not null check (last_runid >= first_runid),
  runid_sum numeric not null,
  first_start_at timestamptz,
  last_end_at timestamptz not null,
  total_duration_ms numeric not null check (total_duration_ms >= 0),
  max_duration_ms numeric not null check (max_duration_ms >= 0),
  work_count bigint,
  queue_count bigint,
  updated_at timestamptz not null default now(),
  primary key (jobid, minute_bucket, status_class, return_class)
);

create index minute_summaries_retention_idx
  on momi_cron_history.minute_summaries (minute_bucket);

create table momi_cron_history.exception_ledger (
  runid bigint primary key,
  jobid bigint not null,
  status_class text not null check (
    status_class in ('succeeded', 'failed', 'unexpected')
  ),
  return_class text not null check (
    return_class in (
      'null', 'empty', 'row_count', 'select_count', 'insert_count',
      'update_count', 'delete_count', 'call', 'unknown'
    )
  ),
  started_at timestamptz,
  ended_at timestamptz not null,
  duration_ms numeric,
  reasons text[] not null check (
    cardinality(reasons) > 0 and reasons <@ array[
      'failed', 'recovery_after_failure', 'slow', 'unexpected_status',
      'unexpected_return', 'unexpected_timing', 'declared_retry',
      'declared_exception'
    ]::text[]
  ),
  recorded_at timestamptz not null default now()
);

create index exception_ledger_retention_idx
  on momi_cron_history.exception_ledger (ended_at, runid);

create table momi_cron_history.exception_declarations (
  runid bigint primary key,
  exception_kind text not null check (
    exception_kind in ('retry', 'declared_exception')
  ),
  declaration_key text not null check (length(declaration_key) between 1 and 120),
  declared_at timestamptz not null default now()
);

create table momi_cron_history.incident_holds (
  runid bigint primary key,
  hold_key text not null check (length(hold_key) between 1 and 120),
  reason_code text not null check (
    reason_code in ('incident', 'legal', 'privacy', 'security', 'audit')
  ),
  held_at timestamptz not null default now(),
  released_at timestamptz,
  release_key text check (
    release_key is null or length(release_key) between 1 and 120
  ),
  check (
    (released_at is null and release_key is null)
    or (released_at is not null and release_key is not null)
  )
);

create index incident_holds_active_idx
  on momi_cron_history.incident_holds (runid) where released_at is null;

create table momi_cron_history.incomplete_gaps (
  runid bigint primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  observation_count integer not null default 1 check (observation_count > 0)
);

create table momi_cron_history.job_terminal_state (
  jobid bigint primary key,
  last_runid bigint not null,
  last_status_class text not null check (
    last_status_class in ('succeeded', 'failed', 'unexpected')
  ),
  updated_at timestamptz not null default now()
);

create table momi_cron_history.governor_ticks (
  tick_id uuid primary key default gen_random_uuid(),
  capability_token uuid not null default gen_random_uuid() unique,
  tick_status text not null default 'dispatched' check (
    tick_status in ('dispatched', 'claimed', 'completed', 'failed')
  ),
  dispatched_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  result jsonb check (
    result is null or jsonb_typeof(result) = 'object'
  )
);

create index governor_ticks_status_idx
  on momi_cron_history.governor_ticks (tick_status, dispatched_at);

create table momi_cron_history.health_samples (
  sample_id uuid primary key default gen_random_uuid(),
  tick_id uuid not null unique
    references momi_cron_history.governor_ticks(tick_id),
  source_observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source_complete boolean not null,
  cpu_total_seconds numeric,
  cpu_idle_seconds numeric,
  io_busy_seconds numeric,
  cpu_pct numeric check (cpu_pct is null or cpu_pct between 0 and 100),
  ram_pct numeric check (ram_pct is null or ram_pct between 0 and 100),
  swap_used_bytes numeric check (
    swap_used_bytes is null or swap_used_bytes >= 0
  ),
  io_pct numeric check (io_pct is null or io_pct >= 0),
  allocated_disk_pct numeric check (
    allocated_disk_pct is null or allocated_disk_pct between 0 and 100
  ),
  provider_connections integer check (
    provider_connections is null or provider_connections >= 0
  ),
  provider_warning boolean,
  waiting_locks integer not null check (waiting_locks >= 0),
  active_vacuums integer not null check (active_vacuums >= 0),
  old_transactions integer not null check (old_transactions >= 0),
  local_connections integer not null check (local_connections >= 0),
  order_alert_queue_length bigint not null check (order_alert_queue_length >= 0),
  order_alert_oldest_age numeric,
  projection_queue_length bigint not null check (projection_queue_length >= 0),
  projection_oldest_age numeric,
  order_alert_dlq_length bigint not null check (order_alert_dlq_length >= 0),
  projection_dlq_length bigint not null check (projection_dlq_length >= 0)
);

create index health_samples_recent_idx
  on momi_cron_history.health_samples (source_observed_at desc);

create table momi_cron_history.batch_receipts (
  batch_id uuid primary key,
  tick_id uuid not null unique references momi_cron_history.governor_ticks(tick_id),
  batch_status text not null check (
    batch_status in ('dry_run', 'completed', 'no_data')
  ),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  cursor_before bigint not null,
  cursor_after bigint not null,
  high_water_runid bigint not null,
  scanned_count integer not null check (scanned_count between 0 and 5000),
  summarized_count integer not null check (summarized_count between 0 and 5000),
  exception_count integer not null check (exception_count between 0 and 5000),
  held_count integer not null check (held_count between 0 and 5000),
  deleted_count integer not null check (deleted_count between 0 and 5000),
  expired_summary_count integer not null check (
    expired_summary_count between 0 and 5000
  ),
  candidate_digest text check (
    candidate_digest is null or candidate_digest ~ '^[0-9a-f]{64}$'
  ),
  wal_bytes numeric not null check (wal_bytes >= 0),
  temp_bytes numeric not null check (temp_bytes >= 0),
  duration_ms numeric not null check (duration_ms >= 0),
  stop_reason text,
  created_at timestamptz not null default now()
);

create table momi_cron_history.batch_summary_coverage (
  batch_id uuid not null references momi_cron_history.batch_receipts(batch_id)
    deferrable initially deferred,
  jobid bigint not null,
  minute_bucket timestamptz not null,
  status_class text not null,
  return_class text not null,
  run_count integer not null check (run_count > 0),
  runid_digest text not null check (runid_digest ~ '^[0-9a-f]{64}$'),
  primary key (
    batch_id, jobid, minute_bucket, status_class, return_class
  )
);

create table momi_cron_history.batch_candidates (
  batch_id uuid not null,
  runid bigint not null,
  jobid bigint not null,
  status_class text not null,
  return_class text not null,
  minute_bucket timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz not null,
  duration_ms numeric,
  exception_reasons text[] not null,
  held boolean not null,
  primary key (batch_id, runid)
);

alter table momi_cron_history.policy_control enable row level security;
alter table momi_cron_history.scan_state enable row level security;
alter table momi_cron_history.minute_summaries enable row level security;
alter table momi_cron_history.exception_ledger enable row level security;
alter table momi_cron_history.exception_declarations enable row level security;
alter table momi_cron_history.incident_holds enable row level security;
alter table momi_cron_history.incomplete_gaps enable row level security;
alter table momi_cron_history.job_terminal_state enable row level security;
alter table momi_cron_history.governor_ticks enable row level security;
alter table momi_cron_history.health_samples enable row level security;
alter table momi_cron_history.batch_receipts enable row level security;
alter table momi_cron_history.batch_summary_coverage enable row level security;
alter table momi_cron_history.batch_candidates enable row level security;

revoke all on schema momi_cron_history
  from public, anon, authenticated, service_role;
revoke all on all tables in schema momi_cron_history
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema momi_cron_history
  from public, anon, authenticated, service_role;

create function momi_cron_history.classify_return_v1(p_message text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_message is null then 'null'
    when p_message = '' then 'empty'
    when p_message ~ '^[0-9]+ rows?$' then 'row_count'
    when p_message ~ '^SELECT [0-9]+$' then 'select_count'
    when p_message ~ '^INSERT [0-9]+ [0-9]+$' then 'insert_count'
    when p_message ~ '^UPDATE [0-9]+$' then 'update_count'
    when p_message ~ '^DELETE [0-9]+$' then 'delete_count'
    when p_message = 'CALL' then 'call'
    else 'unknown'
  end
$$;

create function momi_cron_history.pause_v1(p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  if p_reason is null or length(p_reason) not between 1 and 160 then
    raise exception 'invalid pause reason' using errcode = '22023';
  end if;
  if not pg_try_advisory_xact_lock(
    hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
  ) then
    return false;
  end if;
  update momi_cron_history.policy_control set
    phase = 'paused', last_stop_reason = p_reason, updated_at = now()
  where singleton;
  return true;
end;
$$;

create function momi_cron_history.configure_v1(
  p_phase text,
  p_batch_size integer,
  p_order_alert_dlq_ceiling bigint,
  p_projection_dlq_ceiling bigint,
  p_accepted_rate_receipt text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_policy momi_cron_history.policy_control%rowtype;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  if not pg_try_advisory_xact_lock(
    hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
  ) then
    return false;
  end if;
  select * into current_policy from momi_cron_history.policy_control
  where singleton for update;
  if p_phase not in (
    'disarmed', 'dry_run', 'canary', 'drain', 'steady', 'paused'
  ) or p_batch_size not between 1 and 5000
    or p_order_alert_dlq_ceiling is null
    or p_order_alert_dlq_ceiling < 0
    or p_projection_dlq_ceiling is null
    or p_projection_dlq_ceiling < 0 then
    raise exception 'invalid governor configuration' using errcode = '22023';
  end if;
  if p_phase = 'canary'
    and (not current_policy.dry_run_complete or p_batch_size > 500) then
    raise exception 'canary requires dry-run receipt and at most 500 rows'
      using errcode = '22023';
  end if;
  if p_phase in ('drain', 'steady') and not current_policy.canary_complete then
    raise exception 'drain requires canary receipt' using errcode = '22023';
  end if;
  if p_batch_size > 1000 and (
    p_accepted_rate_receipt is null
    or length(p_accepted_rate_receipt) not between 1 and 240
  ) then
    raise exception 'rate above 1000 requires an accepted receipt'
      using errcode = '22023';
  end if;
  update momi_cron_history.policy_control set
    phase = p_phase,
    batch_size = p_batch_size,
    order_alert_dlq_ceiling = p_order_alert_dlq_ceiling,
    projection_dlq_ceiling = p_projection_dlq_ceiling,
    accepted_rate_receipt = case
      when p_batch_size > 1000 then p_accepted_rate_receipt else null end,
    last_stop_reason = null,
    updated_at = now()
  where singleton;
  return true;
end;
$$;

create function momi_cron_history.register_hold_v1(
  p_runid bigint, p_hold_key text, p_reason_code text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare raw_end_time timestamptz;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  if p_runid is null or p_runid <= 0
    or p_hold_key is null or length(p_hold_key) not between 1 and 120
    or p_reason_code not in ('incident', 'legal', 'privacy', 'security', 'audit')
    or not pg_try_advisory_xact_lock(
      hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
    ) then
    return false;
  end if;
  select end_time into raw_end_time from cron.job_run_details
  where runid = p_runid;
  if not found or (
    raw_end_time is not null
    and raw_end_time < now() - interval '7 days'
  ) then
    return false;
  end if;
  insert into momi_cron_history.incident_holds (
    runid, hold_key, reason_code
  ) values (p_runid, p_hold_key, p_reason_code)
  on conflict (runid) do nothing;
  return found;
end;
$$;

create function momi_cron_history.release_hold_v1(
  p_runid bigint, p_release_key text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  if p_runid is null or p_runid <= 0
    or p_release_key is null or length(p_release_key) not between 1 and 120
    or not pg_try_advisory_xact_lock(
      hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
    ) then
    return false;
  end if;
  update momi_cron_history.incident_holds set
    released_at = now(), release_key = p_release_key
  where runid = p_runid and released_at is null;
  return found;
end;
$$;

create function momi_cron_history.register_exception_v1(
  p_runid bigint, p_exception_kind text, p_declaration_key text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare raw_end_time timestamptz;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  if p_runid is null or p_runid <= 0
    or p_exception_kind not in ('retry', 'declared_exception')
    or p_declaration_key is null
    or length(p_declaration_key) not between 1 and 120
    or not pg_try_advisory_xact_lock(
      hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
    ) then
    return false;
  end if;
  select end_time into raw_end_time from cron.job_run_details
  where runid = p_runid;
  if not found or (
    raw_end_time is not null
    and raw_end_time < now() - interval '7 days'
  ) then
    return false;
  end if;
  insert into momi_cron_history.exception_declarations (
    runid, exception_kind, declaration_key
  ) values (p_runid, p_exception_kind, p_declaration_key)
  on conflict (runid) do nothing;
  return found;
end;
$$;

create function momi_cron_history.health_gate_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  latest momi_cron_history.health_samples%rowtype;
  policy momi_cron_history.policy_control%rowtype;
  sample_count integer;
  oldest_sample timestamptz;
  newest_sample timestamptz;
  max_gap interval;
  cpu_p95 numeric;
  max_ram numeric;
  max_io numeric;
  max_disk numeric;
  min_swap numeric;
  max_swap numeric;
  avg_connections numeric;
  max_order_queue bigint;
  max_projection_queue bigint;
  any_warning boolean;
  any_lock integer;
  any_vacuum integer;
  any_old_xact integer;
  reasons text[] := array[]::text[];
begin
  select * into policy from momi_cron_history.policy_control where singleton;
  select * into latest from momi_cron_history.health_samples
  order by source_observed_at desc limit 1;
  if not found then
    return jsonb_build_object(
      'state', 'warming', 'reasons', jsonb_build_array('no_health_samples')
    );
  end if;
  if not latest.source_complete then
    return jsonb_build_object(
      'state', 'stop', 'reasons', jsonb_build_array('metrics_incomplete')
    );
  end if;

  with recent as (
    select * from momi_cron_history.health_samples
    where source_complete
      and cpu_pct is not null
      and ram_pct is not null
      and swap_used_bytes is not null
      and io_pct is not null
      and allocated_disk_pct is not null
      and provider_warning is not null
    order by source_observed_at desc limit 15
  ), gaps as (
    select source_observed_at - lag(source_observed_at) over (
      order by source_observed_at
    ) as gap
    from recent
  )
  select
    count(*), min(source_observed_at), max(source_observed_at),
    (select max(gap) from gaps),
    percentile_cont(0.95) within group (order by cpu_pct),
    max(ram_pct), max(io_pct), max(allocated_disk_pct),
    min(swap_used_bytes), max(swap_used_bytes),
    avg(coalesce(provider_connections, local_connections)),
    max(order_alert_queue_length),
    max(projection_queue_length), bool_or(provider_warning),
    max(waiting_locks), max(active_vacuums), max(old_transactions)
  into
    sample_count, oldest_sample, newest_sample, max_gap, cpu_p95,
    max_ram, max_io, max_disk, min_swap, max_swap, avg_connections,
    max_order_queue, max_projection_queue, any_warning, any_lock,
    any_vacuum, any_old_xact
  from recent;

  if sample_count < 15
    or newest_sample - oldest_sample < interval '13 minutes' then
    return jsonb_build_object(
      'state', 'warming',
      'reasons', jsonb_build_array('fifteen_minute_baseline_incomplete'),
      'complete_samples', sample_count
    );
  end if;
  if now() - newest_sample > interval '90 seconds'
    or max_gap > interval '90 seconds' then
    reasons := array_append(reasons, 'metrics_stale');
  end if;
  if cpu_p95 is null or cpu_p95 >= 50 then
    reasons := array_append(reasons, 'cpu_start_threshold');
  end if;
  if latest.cpu_pct >= 70 or latest.cpu_pct >= cpu_p95 + 15 then
    reasons := array_append(reasons, 'cpu_stop_threshold');
  end if;
  if max_ram is null or max_ram >= 70 then
    reasons := array_append(reasons, 'ram_start_threshold');
  end if;
  if latest.ram_pct >= 80 then
    reasons := array_append(reasons, 'ram_stop_threshold');
  end if;
  if min_swap is null or max_swap is null or max_swap > min_swap then
    reasons := array_append(reasons, 'swap_growth');
  end if;
  if max_io is null or max_io >= 40 then
    reasons := array_append(reasons, 'io_start_threshold');
  end if;
  if latest.io_pct >= 60 then
    reasons := array_append(reasons, 'io_stop_threshold');
  end if;
  if max_disk is null or max_disk >= 75 then
    reasons := array_append(reasons, 'disk_headroom_threshold');
  end if;
  if latest.allocated_disk_pct >= 80 then
    reasons := array_append(reasons, 'disk_stop_threshold');
  end if;
  if coalesce(any_warning, true) then
    reasons := array_append(reasons, 'provider_pressure_warning');
  end if;
  if any_lock > 0 then
    reasons := array_append(reasons, 'waiting_lock');
  end if;
  if any_vacuum > 0 then
    reasons := array_append(reasons, 'vacuum_conflict');
  end if;
  if any_old_xact > 0 then
    reasons := array_append(reasons, 'old_transaction');
  end if;
  if coalesce(latest.provider_connections, latest.local_connections)
    > avg_connections + 2 then
    reasons := array_append(reasons, 'connection_growth');
  end if;
  if max_order_queue > 0 or latest.order_alert_oldest_age is not null then
    reasons := array_append(reasons, 'order_alert_queue_degradation');
  end if;
  if max_projection_queue > 0 or latest.projection_oldest_age is not null then
    reasons := array_append(reasons, 'projection_queue_degradation');
  end if;
  if policy.order_alert_dlq_ceiling is null
    or latest.order_alert_dlq_length > policy.order_alert_dlq_ceiling then
    reasons := array_append(reasons, 'order_alert_dead_letter_growth');
  end if;
  if policy.projection_dlq_ceiling is null
    or latest.projection_dlq_length > policy.projection_dlq_ceiling then
    reasons := array_append(reasons, 'projection_dead_letter_growth');
  end if;

  return jsonb_build_object(
    'state', case when cardinality(reasons) = 0 then 'ready' else 'stop' end,
    'reasons', to_jsonb(reasons),
    'complete_samples', sample_count,
    'cpu_p95', cpu_p95,
    'ram_max', max_ram,
    'io_max', max_io,
    'disk_used_max', max_disk
  );
end;
$$;

create function momi_cron_history.claim_governor_tick_v1(
  p_tick_id uuid, p_capability_token uuid
) returns table (
  tick_status text,
  phase text,
  previous_source_observed_at timestamptz,
  previous_cpu_total_seconds numeric,
  previous_cpu_idle_seconds numeric,
  previous_io_busy_seconds numeric
) language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  update momi_cron_history.governor_ticks set
    tick_status = 'claimed', claimed_at = coalesce(claimed_at, now())
  where tick_id = p_tick_id
    and capability_token = p_capability_token
    and tick_status in ('dispatched', 'claimed')
    and dispatched_at >= now() - interval '2 minutes';
  if not found and not exists (
    select 1 from momi_cron_history.governor_ticks
    where governor_ticks.tick_id = p_tick_id
      and capability_token = p_capability_token
      and governor_ticks.tick_status = 'completed'
  ) then
    return;
  end if;
  return query
  select ticks.tick_status, policy.phase,
    sample.source_observed_at, sample.cpu_total_seconds,
    sample.cpu_idle_seconds, sample.io_busy_seconds
  from momi_cron_history.governor_ticks ticks
  cross join momi_cron_history.policy_control policy
  left join lateral (
    select health.source_observed_at, health.cpu_total_seconds,
      health.cpu_idle_seconds, health.io_busy_seconds
    from momi_cron_history.health_samples health
    where health.tick_id <> p_tick_id
    order by health.source_observed_at desc limit 1
  ) sample on true
  where ticks.tick_id = p_tick_id
    and ticks.capability_token = p_capability_token
    and policy.singleton;
end;
$$;

create function momi_cron_history.read_tick_receipt_v1(
  p_tick_id uuid, p_capability_token uuid
) returns jsonb language sql security definer set search_path = '' as $$
  select result from momi_cron_history.governor_ticks
  where tick_id = p_tick_id
    and capability_token = p_capability_token
    and tick_status = 'completed'
$$;

create function momi_cron_history.dispatch_governor_tick_v1()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  current_phase text;
  unresolved integer;
  project_url text;
  gateway_key text;
  new_tick momi_cron_history.governor_ticks%rowtype;
  request_id bigint;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  select phase into current_phase from momi_cron_history.policy_control
  where singleton;
  if current_phase in ('disarmed', 'paused') then return 0; end if;

  select count(*) into unresolved from momi_cron_history.governor_ticks
  where tick_status = 'claimed'
    and claimed_at < now() - interval '90 seconds';
  if unresolved > 0 then
    update momi_cron_history.policy_control set
      phase = 'paused', last_stop_reason = 'unknown_commit',
      updated_at = now()
    where singleton;
    return 0;
  end if;

  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  if project_url is null or gateway_key is null then
    update momi_cron_history.policy_control set
      phase = 'paused', last_stop_reason = 'dispatcher_secret_missing',
      updated_at = now()
    where singleton;
    return 0;
  end if;

  insert into momi_cron_history.governor_ticks default values
  returning * into new_tick;
  select net.http_post(
    url := rtrim(project_url, '/')
      || '/functions/v1/momi-cron-history-governor-v1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'tick_id', new_tick.tick_id::text,
      'capability_token', new_tick.capability_token::text
    ),
    timeout_milliseconds := 3000
  ) into request_id;
  return request_id;
end;
$$;

create function momi_cron_history.run_batch_v1(
  p_batch_id uuid, p_limit integer, p_dry_run boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  policy momi_cron_history.policy_control%rowtype;
  cursor_before bigint;
  cursor_after bigint;
  high_water bigint;
  started timestamptz := clock_timestamp();
  completed timestamptz;
  wal_start pg_lsn;
  wal_bytes numeric;
  temp_before numeric;
  temp_after numeric;
  candidate_count integer;
  summary_count integer;
  exception_count integer;
  held_count integer;
  expected_delete_count integer;
  deleted_count integer := 0;
  affected integer;
  expired_summary_count integer := 0;
  remaining integer;
  candidate_digest text;
  purge_runids bigint[];
  receipt_status text;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  perform set_config('work_mem', '4MB', true);
  if p_batch_id is null or p_limit not between 1 and 5000 then
    raise exception 'invalid batch request' using errcode = '22023';
  end if;
  if not pg_try_advisory_xact_lock(
    hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
  ) then
    raise exception 'cleanup writer already active' using errcode = '55P03';
  end if;

  select * into policy from momi_cron_history.policy_control
  where singleton for update;
  if p_limit > policy.batch_size
    or (policy.phase = 'canary' and p_limit > 500)
    or (p_limit > 1000 and policy.accepted_rate_receipt is null) then
    raise exception 'batch exceeds accepted rate' using errcode = '22023';
  end if;
  if policy.last_batch_at is not null
    and policy.last_batch_at > now() - interval '30 seconds' then
    raise exception 'batch pause interval not satisfied' using errcode = '55000';
  end if;

  select cursor_runid into cursor_before
  from momi_cron_history.scan_state where singleton for update;
  select coalesce(max(runid), cursor_before) into high_water
  from cron.job_run_details;
  wal_start := pg_current_wal_insert_lsn();
  select temp_bytes into temp_before from pg_stat_database
  where datname = current_database();

  delete from momi_cron_history.batch_candidates
  where batch_id = p_batch_id;

  with next_window as (
    select raw.runid, raw.jobid, raw.status, raw.return_message,
      raw.start_time, raw.end_time, declarations.exception_kind,
      holds.runid is not null as held,
      case
        when raw.status = 'succeeded' then 'succeeded'
        when raw.status = 'failed' then 'failed'
        else 'unexpected'
      end as status_class,
      momi_cron_history.classify_return_v1(raw.return_message) as return_class
    from cron.job_run_details raw
    left join momi_cron_history.exception_declarations declarations
      on declarations.runid = raw.runid
    left join momi_cron_history.incident_holds holds
      on holds.runid = raw.runid and holds.released_at is null
    where raw.runid > cursor_before and raw.runid <= high_water
    order by raw.runid
    limit p_limit
  ), barrier as (
    select min(runid) as runid from next_window
    where end_time is null
      or status in ('connecting', 'running')
      or end_time >= now() - policy.raw_retention
  ), eligible as (
    select windowed.*,
      extract(epoch from (
        windowed.end_time - windowed.start_time
      )) * 1000 as duration_ms,
      lag(windowed.status_class) over (
        partition by windowed.jobid order by windowed.runid
      ) as batch_previous_status
    from next_window windowed
    where windowed.runid < coalesce((select runid from barrier), high_water + 1)
  ), classified as (
    select eligible.*,
      coalesce(
        eligible.batch_previous_status, state.last_status_class
      ) as previous_status
    from eligible
    left join momi_cron_history.job_terminal_state state
      on state.jobid = eligible.jobid
  )
  insert into momi_cron_history.batch_candidates (
    batch_id, runid, jobid, status_class, return_class, minute_bucket,
    started_at, ended_at, duration_ms, exception_reasons, held
  )
  select
    p_batch_id, runid, jobid, status_class, return_class,
    date_trunc('minute', end_time), start_time, end_time, duration_ms,
    array_remove(array[
      case when status_class = 'failed' then 'failed' end,
      case when status_class = 'unexpected' then 'unexpected_status' end,
      case when return_class = 'unknown' then 'unexpected_return' end,
      case when start_time is null or duration_ms is null or duration_ms < 0
        then 'unexpected_timing' end,
      case when duration_ms >= extract(
        epoch from policy.slow_run_threshold
      ) * 1000 then 'slow' end,
      case when previous_status = 'failed' and status_class = 'succeeded'
        then 'recovery_after_failure' end,
      case when exception_kind = 'retry' then 'declared_retry' end,
      case when exception_kind = 'declared_exception'
        then 'declared_exception' end
    ], null)::text[],
    held
  from classified
  order by runid;

  select count(*),
    count(*) filter (where cardinality(exception_reasons) = 0),
    count(*) filter (where cardinality(exception_reasons) > 0),
    count(*) filter (where held),
    encode(sha256(convert_to(
      coalesce(string_agg(runid::text, ',' order by runid), ''), 'UTF8'
    )), 'hex')
  into candidate_count, summary_count, exception_count, held_count,
    candidate_digest
  from momi_cron_history.batch_candidates
  where batch_id = p_batch_id;
  cursor_after := cursor_before;

  if p_dry_run then
    delete from momi_cron_history.batch_candidates
    where batch_id = p_batch_id;
    completed := clock_timestamp();
    wal_bytes := pg_wal_lsn_diff(pg_current_wal_insert_lsn(), wal_start);
    select temp_bytes into temp_after from pg_stat_database
    where datname = current_database();
    if wal_bytes >= 33554432 or temp_after > temp_before then
      raise exception 'dry-run resource ceiling breached'
        using errcode = '54000';
    end if;
    insert into momi_cron_history.batch_receipts (
      batch_id, tick_id, batch_status, started_at, completed_at,
      cursor_before, cursor_after, high_water_runid, scanned_count,
      summarized_count, exception_count, held_count, deleted_count,
      expired_summary_count, candidate_digest, wal_bytes, temp_bytes,
      duration_ms
    ) values (
      p_batch_id, p_batch_id, 'dry_run', started, completed,
      cursor_before, cursor_before, high_water, candidate_count,
      summary_count, exception_count, held_count, 0, 0,
      case when candidate_count = 0 then null else candidate_digest end,
      wal_bytes, temp_after - temp_before,
      extract(epoch from completed - started) * 1000
    );
    return jsonb_build_object(
      'batch_id', p_batch_id, 'status', 'dry_run',
      'scanned', candidate_count, 'summarized', summary_count,
      'exceptions', exception_count, 'held', held_count, 'deleted', 0,
      'cursor_before', cursor_before, 'cursor_after', cursor_before
    );
  end if;

  insert into momi_cron_history.minute_summaries (
    jobid, minute_bucket, status_class, return_class, run_count,
    first_runid, last_runid, runid_sum, first_start_at, last_end_at,
    total_duration_ms, max_duration_ms
  )
  select jobid, minute_bucket, status_class, return_class, count(*),
    min(runid), max(runid), sum(runid::numeric), min(started_at),
    max(ended_at), sum(duration_ms), max(duration_ms)
  from momi_cron_history.batch_candidates
  where batch_id = p_batch_id and cardinality(exception_reasons) = 0
  group by jobid, minute_bucket, status_class, return_class
  on conflict (jobid, minute_bucket, status_class, return_class)
  do update set
    run_count = momi_cron_history.minute_summaries.run_count
      + excluded.run_count,
    first_runid = least(
      momi_cron_history.minute_summaries.first_runid, excluded.first_runid
    ),
    last_runid = greatest(
      momi_cron_history.minute_summaries.last_runid, excluded.last_runid
    ),
    runid_sum = momi_cron_history.minute_summaries.runid_sum
      + excluded.runid_sum,
    first_start_at = least(
      momi_cron_history.minute_summaries.first_start_at,
      excluded.first_start_at
    ),
    last_end_at = greatest(
      momi_cron_history.minute_summaries.last_end_at, excluded.last_end_at
    ),
    total_duration_ms = momi_cron_history.minute_summaries.total_duration_ms
      + excluded.total_duration_ms,
    max_duration_ms = greatest(
      momi_cron_history.minute_summaries.max_duration_ms,
      excluded.max_duration_ms
    ),
    updated_at = now();

  insert into momi_cron_history.batch_summary_coverage (
    batch_id, jobid, minute_bucket, status_class, return_class,
    run_count, runid_digest
  )
  select p_batch_id, jobid, minute_bucket, status_class, return_class,
    count(*), encode(sha256(convert_to(
      string_agg(runid::text, ',' order by runid), 'UTF8'
    )), 'hex')
  from momi_cron_history.batch_candidates
  where batch_id = p_batch_id and cardinality(exception_reasons) = 0
  group by jobid, minute_bucket, status_class, return_class;

  if coalesce((
    select sum(run_count) from momi_cron_history.batch_summary_coverage
    where batch_id = p_batch_id
  ), 0) <> summary_count then
    raise exception 'summary coverage mismatch' using errcode = 'P0001';
  end if;

  insert into momi_cron_history.exception_ledger (
    runid, jobid, status_class, return_class, started_at, ended_at,
    duration_ms, reasons
  )
  select runid, jobid, status_class, return_class, started_at, ended_at,
    duration_ms, exception_reasons
  from momi_cron_history.batch_candidates
  where batch_id = p_batch_id and cardinality(exception_reasons) > 0
  on conflict (runid) do nothing;

  if (
    select count(*) from momi_cron_history.batch_candidates candidates
    join momi_cron_history.exception_ledger ledger
      on ledger.runid = candidates.runid
      and ledger.jobid = candidates.jobid
      and ledger.status_class = candidates.status_class
      and ledger.return_class = candidates.return_class
      and ledger.ended_at = candidates.ended_at
      and ledger.reasons = candidates.exception_reasons
    where candidates.batch_id = p_batch_id
      and cardinality(candidates.exception_reasons) > 0
  ) <> exception_count then
    raise exception 'exception coverage mismatch' using errcode = 'P0001';
  end if;

  select count(*) into expected_delete_count
  from momi_cron_history.batch_candidates
  where batch_id = p_batch_id and not held and (
    cardinality(exception_reasons) = 0
    or ended_at < now() - policy.exception_retention
  );
  delete from cron.job_run_details raw using
    momi_cron_history.batch_candidates candidates
  where candidates.batch_id = p_batch_id
    and raw.runid = candidates.runid
    and not candidates.held
    and (
      cardinality(candidates.exception_reasons) = 0
      or candidates.ended_at < now() - policy.exception_retention
    );
  get diagnostics affected = row_count;
  if affected <> expected_delete_count then
    raise exception 'raw deletion readback mismatch' using errcode = 'P0001';
  end if;
  deleted_count := affected;

  insert into momi_cron_history.job_terminal_state (
    jobid, last_runid, last_status_class
  )
  select distinct on (jobid) jobid, runid, status_class
  from momi_cron_history.batch_candidates
  where batch_id = p_batch_id
  order by jobid, runid desc
  on conflict (jobid) do update set
    last_runid = excluded.last_runid,
    last_status_class = excluded.last_status_class,
    updated_at = now()
  where momi_cron_history.job_terminal_state.last_runid < excluded.last_runid;

  select coalesce(max(runid), cursor_before) into cursor_after
  from momi_cron_history.batch_candidates where batch_id = p_batch_id;
  update momi_cron_history.scan_state set
    cursor_runid = cursor_after, last_high_water_runid = high_water,
    updated_at = now()
  where singleton;
  delete from momi_cron_history.incomplete_gaps where runid <= cursor_after;
  insert into momi_cron_history.incomplete_gaps (
    runid, first_seen_at, last_seen_at, observation_count
  )
  select raw.runid, now(), now(), 1
  from cron.job_run_details raw
  where raw.runid > cursor_after and raw.runid <= high_water
    and (raw.end_time is null or raw.status in ('connecting', 'running'))
  order by raw.runid limit 1
  on conflict (runid) do update set
    last_seen_at = now(),
    observation_count =
      momi_cron_history.incomplete_gaps.observation_count + 1;

  remaining := p_limit - candidate_count;
  if remaining > 0 then
    select array_agg(runid order by runid) into purge_runids from (
      select ledger.runid from momi_cron_history.exception_ledger ledger
      join cron.job_run_details raw on raw.runid = ledger.runid
      left join momi_cron_history.incident_holds holds
        on holds.runid = ledger.runid and holds.released_at is null
      where ledger.ended_at < now() - policy.exception_retention
        and holds.runid is null
      order by ledger.runid limit remaining
    ) due;
    if cardinality(purge_runids) > 0 then
      delete from cron.job_run_details where runid = any(purge_runids);
      get diagnostics affected = row_count;
      if affected <> cardinality(purge_runids) then
        raise exception 'exception purge readback mismatch'
          using errcode = 'P0001';
      end if;
      deleted_count := deleted_count + affected;
      delete from momi_cron_history.exception_ledger
      where runid = any(purge_runids);
      get diagnostics affected = row_count;
      if affected <> cardinality(purge_runids) then
        raise exception 'exception ledger purge mismatch'
          using errcode = 'P0001';
      end if;
      remaining := remaining - affected;
    end if;
  end if;

  if remaining > 0 then
    purge_runids := null;
    select array_agg(runid order by runid) into purge_runids from (
      select holds.runid from momi_cron_history.incident_holds holds
      join cron.job_run_details raw on raw.runid = holds.runid
      join momi_cron_history.minute_summaries summaries
        on summaries.jobid = raw.jobid
        and summaries.minute_bucket = date_trunc('minute', raw.end_time)
        and summaries.status_class = case
          when raw.status = 'succeeded' then 'succeeded'
          when raw.status = 'failed' then 'failed'
          else 'unexpected' end
        and summaries.return_class =
          momi_cron_history.classify_return_v1(raw.return_message)
      left join momi_cron_history.exception_ledger ledger
        on ledger.runid = holds.runid
      where holds.released_at is not null
        and raw.end_time < now() - policy.raw_retention
        and ledger.runid is null
      order by holds.runid limit remaining
    ) due;
    if cardinality(purge_runids) > 0 then
      delete from cron.job_run_details where runid = any(purge_runids);
      get diagnostics affected = row_count;
      if affected <> cardinality(purge_runids) then
        raise exception 'released hold purge readback mismatch'
          using errcode = 'P0001';
      end if;
      deleted_count := deleted_count + affected;
      remaining := remaining - affected;
    end if;
  end if;

  if remaining > 0 then
    delete from momi_cron_history.minute_summaries summaries
    where (
      summaries.jobid, summaries.minute_bucket, summaries.status_class,
      summaries.return_class
    ) in (
      select due.jobid, due.minute_bucket, due.status_class, due.return_class
      from momi_cron_history.minute_summaries due
      where due.minute_bucket < now() - policy.summary_retention
        and not exists (
          select 1 from momi_cron_history.incident_holds holds
          join cron.job_run_details raw on raw.runid = holds.runid
          where holds.released_at is null
            and raw.jobid = due.jobid
            and date_trunc('minute', raw.end_time) = due.minute_bucket
        )
      order by due.minute_bucket, due.jobid
      limit remaining
    );
    get diagnostics expired_summary_count = row_count;
  end if;

  delete from momi_cron_history.batch_candidates
  where batch_id = p_batch_id;
  completed := clock_timestamp();
  wal_bytes := pg_wal_lsn_diff(pg_current_wal_insert_lsn(), wal_start);
  select temp_bytes into temp_after from pg_stat_database
  where datname = current_database();
  if wal_bytes >= 33554432 then
    raise exception 'wal ceiling breached' using errcode = '54000';
  end if;
  if temp_after > temp_before then
    raise exception 'temporary spill detected' using errcode = '54000';
  end if;
  if deleted_count > p_limit then
    raise exception 'delete ceiling breached' using errcode = '54000';
  end if;

  receipt_status := case
    when candidate_count = 0 and deleted_count = 0
      and expired_summary_count = 0 then 'no_data'
    else 'completed'
  end;
  insert into momi_cron_history.batch_receipts (
    batch_id, tick_id, batch_status, started_at, completed_at,
    cursor_before, cursor_after, high_water_runid, scanned_count,
    summarized_count, exception_count, held_count, deleted_count,
    expired_summary_count, candidate_digest, wal_bytes, temp_bytes,
    duration_ms
  ) values (
    p_batch_id, p_batch_id, receipt_status, started, completed,
    cursor_before, cursor_after, high_water, candidate_count,
    summary_count, exception_count, held_count, deleted_count,
    expired_summary_count,
    case when candidate_count = 0 then null else candidate_digest end,
    wal_bytes, temp_after - temp_before,
    extract(epoch from completed - started) * 1000
  );
  update momi_cron_history.policy_control set
    last_batch_at = now(), last_stop_reason = null, updated_at = now()
  where singleton;

  return jsonb_build_object(
    'batch_id', p_batch_id, 'status', receipt_status,
    'scanned', candidate_count, 'summarized', summary_count,
    'exceptions', exception_count, 'held', held_count,
    'deleted', deleted_count, 'expired_summaries', expired_summary_count,
    'cursor_before', cursor_before, 'cursor_after', cursor_after,
    'high_water_runid', high_water, 'wal_bytes', wal_bytes,
    'temp_bytes', temp_after - temp_before,
    'duration_ms', extract(epoch from completed - started) * 1000
  );
end;
$$;

create function momi_cron_history.record_provider_sample_v1(
  p_tick_id uuid,
  p_capability_token uuid,
  p_source_observed_at timestamptz,
  p_cpu_total_seconds numeric,
  p_cpu_idle_seconds numeric,
  p_ram_pct numeric,
  p_swap_used_bytes numeric,
  p_io_busy_seconds numeric,
  p_allocated_disk_pct numeric,
  p_provider_connections integer,
  p_provider_warning boolean,
  p_source_complete boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  tick momi_cron_history.governor_ticks%rowtype;
  previous momi_cron_history.health_samples%rowtype;
  policy momi_cron_history.policy_control%rowtype;
  elapsed_seconds numeric;
  cpu_delta numeric;
  idle_delta numeric;
  io_delta numeric;
  derived_cpu_pct numeric;
  derived_io_pct numeric;
  complete boolean;
  waiting_count integer;
  vacuum_count integer;
  old_xact_count integer;
  connection_count integer;
  order_queue_length bigint;
  order_oldest_age numeric;
  projection_queue_length bigint;
  projection_oldest_age numeric;
  order_dlq_length bigint;
  projection_dlq_length bigint;
  gate jsonb;
  batch_result jsonb;
  response jsonb;
  error_state text;
  error_signature text;
  next_error_count integer;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  select * into tick from momi_cron_history.governor_ticks
  where tick_id = p_tick_id and capability_token = p_capability_token
  for update;
  if not found then
    raise exception 'unknown governor tick' using errcode = '28000';
  end if;
  if tick.tick_status = 'completed' then return tick.result; end if;
  if tick.tick_status <> 'claimed'
    or tick.dispatched_at < now() - interval '2 minutes' then
    raise exception 'inactive governor tick' using errcode = '28000';
  end if;

  select * into previous from momi_cron_history.health_samples
  where source_complete
    and cpu_total_seconds is not null
    and cpu_idle_seconds is not null
    and io_busy_seconds is not null
  order by source_observed_at desc limit 1;
  if found then
    elapsed_seconds := extract(
      epoch from p_source_observed_at - previous.source_observed_at
    );
    cpu_delta := p_cpu_total_seconds - previous.cpu_total_seconds;
    idle_delta := p_cpu_idle_seconds - previous.cpu_idle_seconds;
    io_delta := p_io_busy_seconds - previous.io_busy_seconds;
    if elapsed_seconds > 0 and cpu_delta > 0
      and idle_delta between 0 and cpu_delta then
      derived_cpu_pct := least(
        100, greatest(0, (cpu_delta - idle_delta) / cpu_delta * 100)
      );
    end if;
    if elapsed_seconds > 0 and io_delta >= 0 then
      derived_io_pct := greatest(0, io_delta / elapsed_seconds * 100);
    end if;
  end if;

  complete := coalesce(
    coalesce(p_source_complete, false)
    and p_source_observed_at between now() - interval '5 minutes'
      and now() + interval '30 seconds'
    and p_cpu_total_seconds is not null
    and p_cpu_idle_seconds is not null
    and p_io_busy_seconds is not null
    and p_ram_pct between 0 and 100
    and p_swap_used_bytes >= 0
    and p_allocated_disk_pct between 0 and 100
    and p_provider_connections >= 0
    and p_provider_warning is not null,
    false
  );

  select count(*) into waiting_count from pg_locks where not granted;
  select count(*) into vacuum_count from pg_stat_progress_vacuum;
  select count(*) into old_xact_count from pg_stat_activity
  where pid <> pg_backend_pid()
    and xact_start < now() - interval '30 seconds';
  select count(*) into connection_count from pg_stat_activity
  where datname = current_database();
  select queue_length, oldest_msg_age_sec
  into order_queue_length, order_oldest_age
  from pgmq.metrics('order_alerting_v1');
  select queue_length, oldest_msg_age_sec
  into projection_queue_length, projection_oldest_age
  from pgmq.metrics('warehouse_projection_toast_v1');
  select queue_length into order_dlq_length
  from pgmq.metrics('order_alerting_v1_dead_letter');
  select queue_length into projection_dlq_length
  from pgmq.metrics('warehouse_projection_toast_v1_dead_letter');

  insert into momi_cron_history.health_samples (
    tick_id, source_observed_at, source_complete,
    cpu_total_seconds, cpu_idle_seconds, io_busy_seconds,
    cpu_pct, ram_pct, swap_used_bytes, io_pct, allocated_disk_pct,
    provider_connections, provider_warning, waiting_locks,
    active_vacuums, old_transactions, local_connections,
    order_alert_queue_length, order_alert_oldest_age,
    projection_queue_length, projection_oldest_age,
    order_alert_dlq_length, projection_dlq_length
  ) values (
    p_tick_id, p_source_observed_at, complete,
    p_cpu_total_seconds, p_cpu_idle_seconds, p_io_busy_seconds,
    derived_cpu_pct, p_ram_pct, p_swap_used_bytes, derived_io_pct,
    p_allocated_disk_pct, p_provider_connections, p_provider_warning,
    waiting_count, vacuum_count, old_xact_count, connection_count,
    order_queue_length, order_oldest_age,
    projection_queue_length, projection_oldest_age,
    order_dlq_length, projection_dlq_length
  );

  select * into policy from momi_cron_history.policy_control
  where singleton for update;
  gate := momi_cron_history.health_gate_v1();
  if policy.phase in ('disarmed', 'paused') then
    response := jsonb_build_object(
      'ok', false, 'function_key', 'momi.cron_history.governor.v1',
      'tick_id', p_tick_id, 'phase', policy.phase,
      'disposition', 'inactive', 'receipt', null
    );
  elsif gate->>'state' = 'warming' then
    response := jsonb_build_object(
      'ok', true, 'function_key', 'momi.cron_history.governor.v1',
      'tick_id', p_tick_id, 'phase', policy.phase,
      'disposition', 'health_warming', 'receipt', gate
    );
  elsif gate->>'state' <> 'ready' then
    update momi_cron_history.policy_control set
      phase = 'paused',
      last_stop_reason = left(
        coalesce(gate->'reasons'->>0, 'health_gate_refused'), 160
      ),
      updated_at = now()
    where singleton;
    response := jsonb_build_object(
      'ok', false, 'function_key', 'momi.cron_history.governor.v1',
      'tick_id', p_tick_id, 'phase', 'paused',
      'disposition', 'health_refused', 'receipt', gate
    );
  elsif policy.last_batch_at is not null
    and policy.last_batch_at > now() - interval '30 seconds' then
    response := jsonb_build_object(
      'ok', true, 'function_key', 'momi.cron_history.governor.v1',
      'tick_id', p_tick_id, 'phase', policy.phase,
      'disposition', 'rate_limited', 'receipt', null
    );
  else
    begin
      batch_result := momi_cron_history.run_batch_v1(
        p_tick_id, policy.batch_size, policy.phase = 'dry_run'
      );
      update momi_cron_history.policy_control set
        dry_run_complete = dry_run_complete or policy.phase = 'dry_run',
        canary_complete = canary_complete or policy.phase = 'canary',
        phase = case when policy.phase in ('dry_run', 'canary')
          then 'paused' else policy.phase end,
        last_stop_reason = case when policy.phase in ('dry_run', 'canary')
          then policy.phase || '_complete' else null end,
        last_error_signature = null,
        identical_error_count = 0,
        updated_at = now()
      where singleton;
      response := jsonb_build_object(
        'ok', true, 'function_key', 'momi.cron_history.governor.v1',
        'tick_id', p_tick_id,
        'phase', case when policy.phase in ('dry_run', 'canary')
          then 'paused' else policy.phase end,
        'disposition', batch_result->>'status', 'receipt', batch_result
      );
    exception when others then
      get stacked diagnostics error_state = returned_sqlstate;
      error_signature := 'batch_error:' || error_state;
      select case when last_error_signature = error_signature
          then identical_error_count + 1 else 1 end
      into next_error_count
      from momi_cron_history.policy_control where singleton;
      update momi_cron_history.policy_control set
        last_error_signature = error_signature,
        identical_error_count = least(next_error_count, 2),
        phase = case when next_error_count >= 2 then 'paused' else phase end,
        last_stop_reason = case when next_error_count >= 2
          then error_signature else last_stop_reason end,
        updated_at = now()
      where singleton;
      response := jsonb_build_object(
        'ok', false, 'function_key', 'momi.cron_history.governor.v1',
        'tick_id', p_tick_id,
        'phase', case when next_error_count >= 2
          then 'paused' else policy.phase end,
        'disposition', 'batch_failed',
        'receipt', jsonb_build_object(
          'error_signature', error_signature,
          'identical_error_count', next_error_count
        )
      );
    end;
  end if;

  update momi_cron_history.governor_ticks set
    tick_status = 'completed', completed_at = now(), result = response
  where tick_id = p_tick_id;
  return response;
end;
$$;

revoke all on all functions in schema momi_cron_history
  from public, anon, authenticated;
grant usage on schema momi_cron_history to service_role;
grant execute on function momi_cron_history.claim_governor_tick_v1(uuid, uuid),
  momi_cron_history.read_tick_receipt_v1(uuid, uuid),
  momi_cron_history.record_provider_sample_v1(
    uuid, uuid, timestamptz, numeric, numeric, numeric, numeric,
    numeric, numeric, integer, boolean, boolean
  ),
  momi_cron_history.configure_v1(text, integer, bigint, bigint, text),
  momi_cron_history.pause_v1(text),
  momi_cron_history.register_hold_v1(bigint, text, text),
  momi_cron_history.release_hold_v1(bigint, text),
  momi_cron_history.register_exception_v1(bigint, text, text)
to service_role;

select cron.schedule(
  'momi-cron-history-governor-v1',
  '* * * * *',
  'select momi_cron_history.dispatch_governor_tick_v1()'
);
