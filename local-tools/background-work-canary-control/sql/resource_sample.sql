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
database_statistics as (
  select deadlocks, numbackends
  from pg_stat_database
  where datname = current_database()
)
select
  'momi.background-work-canary.resource'::text as marker,
  1::integer as schema_version,
  jsonb_build_object(
    'observedAtUtcMs', floor(extract(epoch from c.observed_at) * 1000)::bigint,
    'activeCronExecutions', a.active_executions,
    'currentMaxRunId', l.runid,
    'coveredAfterRunId', greatest(l.runid - 16384, 0),
    'maximumTargetRunId', coalesce((select max(r.runid) from run_window r
      where r.jobid in (2, 3, 4, 11)), 0),
    'maximumTargetFailureRunId', coalesce((select max(r.runid) from run_window r
      where r.jobid in (2, 3, 4, 11) and r.status <> 'succeeded'), 0),
    'guardIdentityCount', g.identity_count,
    'guardJobId', case when g.identity_count = 1 then g.jobid else 0 end,
    'guardRunCount', (select count(*) from run_window r
      where g.identity_count = 1 and r.jobid = g.jobid),
    'guardFailureCount', (select count(*) from run_window r
      where g.identity_count = 1 and r.jobid = g.jobid and r.status <> 'succeeded'),
    'databaseBytes', pg_database_size(current_database()),
    'cronHistoryBytes', pg_total_relation_size('cron.job_run_details'::regclass),
    'walDirectoryBytes', (select coalesce(sum(size), 0) from pg_ls_waldir()),
    'waitingLocks', (select count(*) from pg_locks
      where not granted
        and relation in (
          'toast_acquisition.jobs'::regclass,
          'momi_events.routing_work'::regclass,
          'momi_events.deliveries'::regclass,
          'cron.job'::regclass
        )),
    'deadlocks', d.deadlocks,
    'databaseBackends', d.numbackends
  ) as sample
from sample_clock c
cross join latest_run l
cross join guard_identity g
cross join cron_activity a
cross join database_statistics d;
