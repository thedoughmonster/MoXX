with
sample_clock as (
  select clock_timestamp() as observed_at
),
latest_run as (
  select coalesce(max(runid), 0)::bigint as runid
  from cron.job_run_details
),
run_window as (
  select d.runid, d.jobid, d.status
  from cron.job_run_details d
  cross join latest_run l
  where d.runid > greatest(l.runid - 16384, 0)
),
guard_identity as (
  select count(*)::bigint as identity_count, coalesce(min(jobid), 0)::bigint as jobid
  from cron.job
  where jobname = 'momi-issue-330-canary-deadman-v1'
),
cron_activity as (
  select count(*)::bigint as active_executions
  from pg_stat_activity
  where application_name ilike 'pg_cron%'
    and state = 'active'
),
running_cron as (
  select jobid
  from run_window
  where status = 'running'
),
queue_totals as (
  select
    coalesce(sum(queue_length) filter (
      where queue_name in ('warehouse_projection_toast_v1', 'order_alerting_v1')
    ), 0)::bigint as ready,
    coalesce(sum(queue_length) filter (
      where queue_name in (
        'warehouse_projection_toast_v1_dead_letter',
        'order_alerting_v1_dead_letter'
      )
    ), 0)::bigint as dead
  from pgmq.metrics_all()
),
worker_violations as (
  select count(*)::bigint as rows
  from (
    select j.operation_key, j.restaurant_guid
    from toast_acquisition.jobs j
    join toast_acquisition.operations o using (operation_key)
    where o.worker_batch_enabled
      and (
        (j.status = 'running' and j.lease_expires_at > now())
        or (
          j.status in ('pending', 'retry_wait')
          and j.last_dispatched_at > now() - interval '30 seconds'
        )
      )
    group by j.operation_key, j.restaurant_guid, o.maximum_active_workers
    having count(*) > o.maximum_active_workers
  ) violations
)
select
  'momi.background-work-canary.fast'::text as marker,
  1::integer as schema_version,
  jsonb_build_object(
    'observedAtUtcMs', floor(extract(epoch from c.observed_at) * 1000)::bigint,
    'activeCronExecutions', a.active_executions,
    'nonTargetNonGuardActiveExecutions', (
      select count(*) from running_cron x
      where x.jobid not in (2, 3, 4, 11)
        and not (g.identity_count = 1 and x.jobid = g.jobid)
    ),
    'currentMaxRunId', l.runid,
    'coveredAfterRunId', greatest(l.runid - 16384, 0),
    'maximumTargetRunId', coalesce((
      select max(r.runid) from run_window r where r.jobid in (2, 3, 4, 11)
    ), 0),
    'maximumTargetFailureRunId', coalesce((
      select max(r.runid) from run_window r
      where r.jobid in (2, 3, 4, 11) and r.status <> 'succeeded'
    ), 0),
    'targetJobs', (
      select jsonb_agg(jsonb_build_object(
        'jobId', j.jobid,
        'jobName', j.jobname,
        'schedule', j.schedule,
        'commandMd5', md5(j.command),
        'active', j.active
      ) order by j.jobid)
      from cron.job j
      where j.jobid in (2, 3, 4, 11)
    ),
    'guardPresent', g.identity_count > 0,
    'guardIdentityCount', g.identity_count,
    'guardJobId', case when g.identity_count = 1 then g.jobid else 0 end,
    'guard', case when g.identity_count = 1 then (
      select jsonb_build_object(
        'jobName', j.jobname,
        'schedule', j.schedule,
        'active', j.active
      )
      from cron.job j
      where j.jobid = g.jobid
    ) else jsonb_build_object(
      'jobName', 'momi-issue-330-canary-deadman-v1',
      'schedule', '5 seconds',
      'active', false
    ) end,
    'guardRunCount', (select count(*) from run_window r
      where g.identity_count = 1 and r.jobid = g.jobid),
    'guardFailureCount', (select count(*) from run_window r
      where g.identity_count = 1 and r.jobid = g.jobid and r.status <> 'succeeded'),
    'toastReady', (select count(*) from toast_acquisition.jobs
      where status = 'pending' and next_attempt_at <= c.observed_at),
    'toastRunning', (select count(*) from toast_acquisition.jobs where status = 'running'),
    'toastRetry', (select count(*) from toast_acquisition.jobs
      where status = 'retry_wait' and next_attempt_at <= c.observed_at),
    'toastDead', (select count(*) from toast_acquisition.jobs where status = 'dead_letter'),
    'routingReady', (select count(*) from momi_events.routing_work
      where status = 'pending' and next_attempt_at <= c.observed_at),
    'routingRunning', (select count(*) from momi_events.routing_work where status = 'running'),
    'routingRetry', (select count(*) from momi_events.routing_work
      where status = 'retry_wait' and next_attempt_at <= c.observed_at),
    'routingDead', (select count(*) from momi_events.routing_work where status = 'dead_letter'),
    'deliveryReady', (select count(*) from momi_events.deliveries
      where status in ('pending', 'queued') and next_attempt_at <= c.observed_at),
    'deliveryRunning', (select count(*) from momi_events.deliveries where status = 'running'),
    'deliveryRetry', (select count(*) from momi_events.deliveries
      where status = 'retry_wait' and next_attempt_at <= c.observed_at),
    'deliveryDead', (select count(*) from momi_events.deliveries where status = 'dead_letter'),
    'queueReady', q.ready,
    'queueDead', q.dead,
    'expiredLeases',
      (select count(*) from toast_acquisition.jobs
        where status = 'running' and lease_expires_at <= c.observed_at)
      + (select count(*) from momi_events.routing_work
        where status = 'running' and lease_expires_at <= c.observed_at)
      + (select count(*) from momi_events.deliveries
        where status = 'running' and lease_expires_at <= c.observed_at),
    'longLeases',
      (select count(*) from toast_acquisition.jobs
        where status = 'running' and lease_expires_at > c.observed_at + interval '120 seconds')
      + (select count(*) from momi_events.routing_work
        where status = 'running' and lease_expires_at > c.observed_at + interval '120 seconds')
      + (select count(*) from momi_events.deliveries
        where status = 'running' and lease_expires_at > c.observed_at + interval '120 seconds'),
    'openAttempts', (select count(*) from toast_raw.api_request_attempts
      where finished_at is null),
    'projectionReservations', (select count(*)
      from warehouse_projection.delivery_reservations),
    'workerCapViolations', w.rows,
    'waitingLocks', (select count(*) from pg_locks
      where not granted
        and relation in (
          'toast_acquisition.jobs'::regclass,
          'momi_events.routing_work'::regclass,
          'momi_events.deliveries'::regclass,
          'cron.job'::regclass
        ))
  ) as sample
from sample_clock c
cross join latest_run l
cross join guard_identity g
cross join cron_activity a
cross join queue_totals q
cross join worker_violations w;
