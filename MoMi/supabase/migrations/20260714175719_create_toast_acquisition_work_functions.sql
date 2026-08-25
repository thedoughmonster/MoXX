-- service-owner: toast-data-acquisition

create function toast_acquisition.claim_job(
  p_job_id bigint,
  p_capability_token uuid
)
returns setof toast_acquisition.jobs
language sql
security invoker
set search_path = ''
as $$
  update toast_acquisition.jobs as job
  set status = 'running', attempt_count = attempt_count + 1,
      lease_expires_at = now() + interval '120 seconds', last_error = null
  from toast_acquisition.operations as operation
  where operation.operation_key = job.operation_key
    and (not operation.exact_resource_only or job.mode = 'repair')
    and job.job_id = p_job_id
    and job.capability_token = p_capability_token
    and job.attempt_count < 12
    and job.page_count < job.page_budget
    and job.next_attempt_at <= now()
    and (
      job.status in ('pending', 'retry_wait')
      or (job.status = 'running' and job.lease_expires_at <= now())
    )
  returning job.*;
$$;

create function toast_acquisition.continue_job(
  p_job_id bigint,
  p_capability_token uuid,
  p_cursor jsonb
)
returns table (disposition text, next_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare rotated_token uuid := gen_random_uuid();
begin
  if jsonb_typeof(p_cursor) <> 'object' then
    raise exception 'Cursor must be an object';
  end if;
  return query update toast_acquisition.jobs as job
  set status = case when job.page_count + 1 >= job.page_budget
        then 'dead_letter' else 'pending' end, cursor = p_cursor,
      next_attempt_at = now(), lease_expires_at = null,
      capability_token = rotated_token, attempt_count = 0,
      page_count = job.page_count + 1,
      last_error = case when job.page_count + 1 >= job.page_budget
        then 'toast_pagination_budget_exhausted' else null end
  where job.job_id = p_job_id and job.capability_token = p_capability_token
    and job.status = 'running' and job.lease_expires_at > now()
    and job.page_count < job.page_budget
  returning case when job.status = 'dead_letter'
      then 'budget_exhausted' else 'continued' end,
    case when job.status = 'pending' then job.capability_token else null end;
  if not found then raise exception 'Acquisition lease is invalid'; end if;
end;
$$;

create function toast_acquisition.complete_job(
  p_job_id bigint,
  p_capability_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  update toast_acquisition.jobs
  set status = 'succeeded', completed_at = now(), lease_expires_at = null,
      attempt_count = 0, page_count = page_count + 1
  where job_id = p_job_id and capability_token = p_capability_token
    and status = 'running' and lease_expires_at > now()
    and page_count < page_budget
  returning true;
$$;

create function toast_acquisition.fail_job(
  p_job_id bigint,
  p_capability_token uuid,
  p_error text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare attempts integer;
begin
  select attempt_count into attempts from toast_acquisition.jobs
  where job_id = p_job_id and capability_token = p_capability_token
    and status = 'running' for update;
  if not found then return 'not_found'; end if;
  update toast_acquisition.jobs
  set status = case when attempts >= 12 then 'dead_letter' else 'retry_wait' end,
      next_attempt_at = now() + make_interval(
        secs => least(3600, 15 * power(2, greatest(0, attempts - 1))::integer)
      ),
      lease_expires_at = null, last_error = left(p_error, 4000)
  where job_id = p_job_id;
  return case when attempts >= 12 then 'dead_letter' else 'retry_wait' end;
end;
$$;

revoke all on function toast_acquisition.claim_job(bigint, uuid)
  from public, anon, authenticated;
revoke all on function toast_acquisition.continue_job(bigint, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function toast_acquisition.complete_job(bigint, uuid)
  from public, anon, authenticated;
revoke all on function toast_acquisition.fail_job(bigint, uuid, text)
  from public, anon, authenticated;
