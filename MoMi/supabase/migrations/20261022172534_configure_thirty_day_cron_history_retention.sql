-- service-owner: cron-history-governance

-- Installation changes no retention choice and never activates cleanup.
alter table momi_cron_history.policy_control
  add column completed_raw_retention interval check (
    completed_raw_retention is null or completed_raw_retention = interval '30 days'
  ),
  add column initial_cutoff timestamptz,
  add column initial_high_water_runid bigint,
  add constraint completed_initial_drain_check check (
    (initial_cutoff is null and initial_high_water_runid is null)
    or (completed_raw_retention is not null and initial_cutoff is not null
      and isfinite(initial_cutoff) and initial_high_water_runid is not null
      and initial_high_water_runid >= 0)
  );

create function momi_cron_history.configure_retention_v1(
  p_completed_raw_retention_days integer default null,
  p_initial_cutoff timestamptz default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  policy momi_cron_history.policy_control%rowtype;
  requested_retention interval;
  high_water bigint;
begin
  perform set_config('lock_timeout', '250ms', true);
  perform set_config('statement_timeout', '3000ms', true);
  if (p_completed_raw_retention_days is not null
      and p_completed_raw_retention_days <> 30)
    or (p_initial_cutoff is not null and (
      p_completed_raw_retention_days is null or not isfinite(p_initial_cutoff)
      or p_initial_cutoff > now() - interval '30 days'
    )) then
    raise exception 'invalid completed-history retention' using errcode = '22023';
  end if;
  if not pg_try_advisory_xact_lock(
    hashtextextended('momi_cron_history.cleanup_writer.v1', 0)
  ) then return false; end if;
  select * into policy from momi_cron_history.policy_control
  where singleton for update;
  if policy.phase not in ('disarmed', 'paused') or exists (
    select 1 from momi_cron_history.governor_ticks where tick_status = 'claimed'
  ) then
    raise exception 'retention changes require a paused, resolved governor'
      using errcode = '55000';
  end if;
  requested_retention := case when p_completed_raw_retention_days = 30
    then interval '30 days' end;
  if requested_retention is distinct from policy.completed_raw_retention
    and exists (
      select 1 from momi_cron_history.batch_receipts
      where batch_status <> 'dry_run'
        and (summarized_count > 0 or exception_count > 0 or deleted_count > 0)
    ) then
    raise exception 'retention profile must be selected before processing history'
      using errcode = '55000';
  end if;
  if policy.initial_cutoff is not null
    and p_initial_cutoff is distinct from policy.initial_cutoff
    and (p_initial_cutoff is not null or exists (
      select 1 from momi_cron_history.scan_state
      where cursor_runid < policy.initial_high_water_runid
    )) then
    raise exception 'finish the fixed initial drain before clearing its cutoff'
      using errcode = '55000';
  end if;
  if p_initial_cutoff is not null then
    select coalesce(max(runid), 0) into high_water from cron.job_run_details;
    if p_initial_cutoff = policy.initial_cutoff then
      high_water := policy.initial_high_water_runid;
    end if;
  end if;
  if policy.initial_cutoff is not null and p_initial_cutoff is null then
    update momi_cron_history.scan_state set cursor_runid = 0, updated_at = now()
    where singleton;
  end if;
  update momi_cron_history.policy_control set
    completed_raw_retention = requested_retention,
    initial_cutoff = p_initial_cutoff, initial_high_water_runid = high_water,
    phase = 'paused', dry_run_complete = false, canary_complete = false,
    batch_size = 500, accepted_rate_receipt = null,
    last_stop_reason = 'retention_requires_acceptance', updated_at = now()
  where singleton;
  return true;
end;
$$;

revoke all on function momi_cron_history.configure_retention_v1(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function momi_cron_history.configure_retention_v1(integer, timestamptz)
  to service_role;

create or replace function momi_cron_history.run_batch_v1(
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
  window_end bigint;
  scanned_count integer;
  scanned_held_count integer;
  raw_cutoff timestamptz;
  completed_policy boolean;
  cycle_high_water bigint;
  finish_initial boolean;
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

  completed_policy := policy.completed_raw_retention is not null;
  raw_cutoff := coalesce(policy.initial_cutoff,
    now() - coalesce(policy.completed_raw_retention, policy.raw_retention));

  select cursor_runid, last_high_water_runid into cursor_before, cycle_high_water
  from momi_cron_history.scan_state where singleton for update;
  select coalesce(max(runid), cursor_before) into high_water
  from cron.job_run_details;
  high_water := coalesce(policy.initial_high_water_runid,
    case when completed_policy and cursor_before > 0
      then nullif(cycle_high_water, 0) end, high_water);
  select coalesce(max(runid), cursor_before), count(*), count(*) filter (where held)
  into window_end, scanned_count, scanned_held_count from (
    select raw.runid, exists (
      select 1 from momi_cron_history.incident_holds holds
      where holds.runid = raw.runid and holds.released_at is null
    ) as held from cron.job_run_details raw
    where runid > cursor_before and runid <= high_water
    order by runid limit p_limit
  ) bounded;
  if completed_policy and scanned_count < p_limit then
    window_end := high_water;
  end if;
  finish_initial := completed_policy and policy.initial_cutoff is not null
    and window_end >= high_water and policy.phase in ('drain', 'steady');
  wal_start := pg_current_wal_insert_lsn();
  select temp_bytes into temp_before from pg_stat_database
  where datname = current_database();

  delete from momi_cron_history.batch_candidates
  where batch_id = p_batch_id;

  with next_window as materialized (
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
    where raw.runid > cursor_before and raw.runid <= window_end
    order by raw.runid
    limit p_limit
  ), barrier as (
    select min(runid) as runid from next_window
    where not completed_policy and (end_time is null
      or status in ('connecting', 'running')
      or end_time >= raw_cutoff)
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
      and (not completed_policy or (
        windowed.status in ('succeeded', 'failed')
        and windowed.start_time is not null and windowed.end_time is not null
        and isfinite(windowed.start_time) and isfinite(windowed.end_time)
        and windowed.end_time >= windowed.start_time
        and windowed.end_time < raw_cutoff and not windowed.held
      ))
  ), classified as (
    select eligible.*,
      coalesce(
        eligible.batch_previous_status,
        case when not completed_policy or state.last_runid < eligible.runid
          then state.last_status_class end
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
  if not completed_policy then scanned_count := candidate_count; end if;
  if completed_policy then held_count := scanned_held_count; end if;

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
      cursor_before, cursor_before, high_water, scanned_count,
      summary_count, exception_count, held_count, 0, 0,
      case when candidate_count = 0 then null else candidate_digest end,
      wal_bytes, temp_after - temp_before,
      extract(epoch from completed - started) * 1000
    );
    return jsonb_build_object(
      'batch_id', p_batch_id, 'status', 'dry_run',
      'scanned', scanned_count, 'summarized', summary_count,
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
    completed_policy or cardinality(exception_reasons) = 0
    or ended_at < now() - policy.exception_retention
  );
  delete from cron.job_run_details raw using
    momi_cron_history.batch_candidates candidates
  where candidates.batch_id = p_batch_id
    and raw.runid = candidates.runid
    and not candidates.held
    and (not completed_policy or (
      raw.status in ('succeeded', 'failed')
      and raw.start_time is not null and raw.end_time is not null
      and isfinite(raw.start_time) and isfinite(raw.end_time)
      and raw.end_time >= raw.start_time and raw.end_time < raw_cutoff
      and raw.start_time = candidates.started_at
      and raw.end_time = candidates.ended_at
      and raw.status = candidates.status_class
      and not exists (
        select 1 from momi_cron_history.incident_holds holds
        where holds.runid = raw.runid and holds.released_at is null
      )
    ))
    and (
      completed_policy or cardinality(candidates.exception_reasons) = 0
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
  if completed_policy then
    cursor_after := window_end;
    if (policy.initial_cutoff is null or finish_initial)
      and window_end >= high_water then
      cursor_after := 0;
    end if;
  end if;
  update momi_cron_history.scan_state set
    cursor_runid = cursor_after, last_high_water_runid = high_water,
    updated_at = now()
  where singleton;
  if not completed_policy then
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
  end if;

  remaining := p_limit - scanned_count;
  if remaining > 0 and not completed_policy then
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

  if remaining > 0 and not completed_policy then
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

  if completed_policy and remaining > 0 then
    delete from momi_cron_history.exception_ledger ledger
    where ledger.runid in (
      select due.runid from momi_cron_history.exception_ledger due
      where due.ended_at < now() - policy.exception_retention
        and not exists (
          select 1 from cron.job_run_details raw where raw.runid = due.runid
        ) and not exists (
          select 1 from momi_cron_history.incident_holds holds
          where holds.runid = due.runid and holds.released_at is null
        )
      order by due.ended_at, due.runid limit remaining
    );
    get diagnostics affected = row_count;
    remaining := remaining - affected;
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
    when scanned_count = 0 and deleted_count = 0
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
    cursor_before, cursor_after, high_water, scanned_count,
    summary_count, exception_count, held_count, deleted_count,
    expired_summary_count,
    case when candidate_count = 0 then null else candidate_digest end,
    wal_bytes, temp_after - temp_before,
    extract(epoch from completed - started) * 1000
  );
  update momi_cron_history.policy_control set
    phase = case when finish_initial then 'steady' else phase end,
    initial_cutoff = case when finish_initial then null else initial_cutoff end,
    initial_high_water_runid = case when finish_initial
      then null else initial_high_water_runid end,
    last_batch_at = now(), last_stop_reason = null, updated_at = now()
  where singleton;

  return jsonb_build_object(
    'batch_id', p_batch_id, 'status', receipt_status,
    'raw_cutoff', raw_cutoff,
    'initial_drain_complete', completed_policy and policy.initial_cutoff is not null
      and window_end >= high_water,
    'scanned', scanned_count, 'summarized', summary_count,
    'exceptions', exception_count, 'held', held_count,
    'deleted', deleted_count, 'expired_summaries', expired_summary_count,
    'cursor_before', cursor_before, 'cursor_after', cursor_after,
    'high_water_runid', high_water, 'wal_bytes', wal_bytes,
    'temp_bytes', temp_after - temp_before,
    'duration_ms', extract(epoch from completed - started) * 1000
  );
end;
$$;

create or replace function momi_cron_history.register_hold_v1(
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
    and raw_end_time < now() - (
      select coalesce(completed_raw_retention, raw_retention)
      from momi_cron_history.policy_control where singleton
    )
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

create or replace function momi_cron_history.register_exception_v1(
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
    and raw_end_time < now() - (
      select coalesce(completed_raw_retention, raw_retention)
      from momi_cron_history.policy_control where singleton
    )
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
