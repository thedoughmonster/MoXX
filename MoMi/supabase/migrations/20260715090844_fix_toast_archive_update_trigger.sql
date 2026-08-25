-- service-owner: toast-data-acquisition

create or replace function toast_raw.reject_archive_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'webhook_events' then
      if old.raw_body is null and not old.raw_body_exact
        and new.raw_body is not null and new.raw_body_exact
        and to_jsonb(new) - 'raw_body' - 'raw_body_exact'
          = to_jsonb(old) - 'raw_body' - 'raw_body_exact' then
        return new;
      end if;
    elsif tg_table_name = 'api_request_attempts' then
      if old.finished_at is null then return new; end if;
      if to_jsonb(new) - 'error_code' - 'error_message'
        = to_jsonb(old) - 'error_code' - 'error_message' then
        return new;
      end if;
    end if;
  end if;
  raise exception 'Archived source row %.% is immutable',
    tg_table_schema, tg_table_name using errcode = '55000';
end;
$$;

update toast_raw.api_request_attempts as attempt
set finished_at = now(), error_code = 'worker_persistence_failed',
    error_message = 'Attempt interrupted by archive completion trigger regression'
from toast_acquisition.jobs as job
where job.job_id = attempt.job_id
  and job.idempotency_key like
    'bootstrap:toast.ordering_schedule.snapshot.v1:%'
  and attempt.finished_at is null;

update toast_acquisition.jobs
set status = 'retry_wait', next_attempt_at = now(),
    lease_expires_at = null, capability_token = gen_random_uuid(),
    last_error = 'retrying after archive completion trigger repair'
where idempotency_key like
  'bootstrap:toast.ordering_schedule.snapshot.v1:%'
  and status <> 'succeeded';

select cron.alter_job(job_id := jobid, active := true)
from cron.job
where jobname = 'momi-toast-acquisition-wakeup-v1';

do $$
begin
  if exists (
    select 1 from toast_raw.api_request_attempts as attempt
    join toast_acquisition.jobs as job using (job_id)
    where job.idempotency_key like
      'bootstrap:toast.ordering_schedule.snapshot.v1:%'
      and attempt.finished_at is null
  ) then raise exception 'Interrupted bootstrap attempts remain open'; end if;
  if not exists (
    select 1 from toast_acquisition.jobs
    where idempotency_key like
      'bootstrap:toast.ordering_schedule.snapshot.v1:%'
      and status in ('retry_wait', 'succeeded')
      and next_attempt_at <> 'infinity'::timestamptz
  ) then raise exception 'Ordering schedule bootstrap was not resumed'; end if;
  if not exists (
    select 1 from cron.job
    where jobname = 'momi-toast-acquisition-wakeup-v1' and active
  ) then raise exception 'Toast acquisition retry wakeup was not resumed'; end if;
end;
$$;
