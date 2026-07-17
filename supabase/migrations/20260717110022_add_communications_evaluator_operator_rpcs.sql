-- service-owner: communications-archive

create function momi_communications.dispatch_evaluation_job_v1(
  p_evaluation_job_id bigint
)
returns table (disposition text, evaluation_job_id bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_archive_item_id uuid;
begin
  if p_evaluation_job_id is null or p_evaluation_job_id <= 0 then
    raise exception 'Evaluation job ID must be positive' using errcode = '22023';
  end if;

  update momi_communications.evaluation_jobs as job
  set capability_token = gen_random_uuid(),
      job_status = case when job.job_status = 'claimed'
        then 'failed' else job.job_status end,
      next_attempt_at = now(),
      lease_expires_at = null,
      last_error_code = case when job.job_status = 'claimed'
        then coalesce(job.last_error_code, 'lease_expired')
        else job.last_error_code end,
      last_error_message = case when job.job_status = 'claimed'
        then coalesce(job.last_error_message, 'evaluator lease expired')
        else job.last_error_message end
  where job.evaluation_job_id = p_evaluation_job_id
    and job.attempt_count < 5
    and (
      (job.job_status in ('pending', 'failed') and job.next_attempt_at <= now())
      or (job.job_status = 'claimed' and job.lease_expires_at <= now())
    )
  returning job.archive_item_id into target_archive_item_id;

  if target_archive_item_id is not null then
    insert into momi_communications.audit_events (
      archive_item_id, actor_key, action_key, tool_version, event_metadata
    ) values (
      target_archive_item_id, 'communications-evaluator-operator',
      'communications.evaluation.dispatched',
      'momi.communications.dispatch_evaluation_job.v1',
      jsonb_build_object('evaluation_job_id', p_evaluation_job_id)
    );
    return query select 'dispatched'::text, p_evaluation_job_id;
    return;
  end if;

  if exists (select 1 from momi_communications.evaluation_jobs as job
    where job.evaluation_job_id = p_evaluation_job_id)
  then return query select 'not_due'::text, p_evaluation_job_id;
  else return query select 'not_found'::text, p_evaluation_job_id;
  end if;
end;
$$;

create function momi_communications.get_evaluation_job_status_v1(
  p_evaluation_job_id bigint
)
returns table (
  evaluation_job_id bigint,
  job_status text,
  attempt_count integer,
  queued_at timestamptz,
  claimed_at timestamptz,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  evaluation_id bigint,
  decision text,
  validation text,
  derived_count integer
)
language sql
security invoker
set search_path = ''
as $$
  select job.evaluation_job_id, job.job_status, job.attempt_count,
    job.queued_at, job.claimed_at, job.next_attempt_at,
    job.lease_expires_at, job.completed_at, job.last_error_code,
    evaluation.evaluation_id, evaluation.decision,
    evaluation.output->>'validation',
    coalesce((select count(*)::integer
      from momi_communications.derived_records as record
      where record.evaluation_id = evaluation.evaluation_id), 0)
  from momi_communications.evaluation_jobs as job
  left join momi_communications.communication_evaluations as evaluation
    on evaluation.evaluation_job_id = job.evaluation_job_id
  where job.evaluation_job_id = p_evaluation_job_id;
$$;

create function momi_communications.get_evaluation_queue_status_v1()
returns table (
  pending_due_count bigint,
  claimed_count bigint,
  failed_due_count bigint,
  dead_letter_count bigint,
  completed_count bigint,
  oldest_due_at timestamptz,
  latest_completed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where job_status = 'pending' and next_attempt_at <= now()),
    count(*) filter (where job_status = 'claimed'),
    count(*) filter (where job_status = 'failed' and next_attempt_at <= now()),
    count(*) filter (where job_status = 'dead_letter'),
    count(*) filter (where job_status = 'completed'),
    min(coalesce(lease_expires_at, next_attempt_at)) filter (where
      (job_status in ('pending', 'failed') and next_attempt_at <= now())
      or (job_status = 'claimed' and lease_expires_at <= now())),
    max(completed_at) filter (where job_status = 'completed')
  from momi_communications.evaluation_jobs;
$$;

revoke all on function momi_communications.dispatch_evaluation_job_v1(bigint)
  from public, anon, authenticated;
revoke all on function momi_communications.get_evaluation_job_status_v1(bigint)
  from public, anon, authenticated;
revoke all on function momi_communications.get_evaluation_queue_status_v1()
  from public, anon, authenticated;

grant execute on function momi_communications.dispatch_evaluation_job_v1(bigint)
  to service_role;
grant execute on function momi_communications.get_evaluation_job_status_v1(bigint)
  to service_role;
grant execute on function momi_communications.get_evaluation_queue_status_v1()
  to service_role;

comment on function momi_communications.dispatch_evaluation_job_v1(bigint) is
  'Dispatches one exact due evaluator job without exposing its capability token.';
comment on function momi_communications.get_evaluation_job_status_v1(bigint) is
  'Returns redacted processing and evaluation status for one evaluator job.';
comment on function momi_communications.get_evaluation_queue_status_v1() is
  'Returns aggregate evaluator queue health without archived communication data.';
