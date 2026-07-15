-- service-owner: toast-data-acquisition

create or replace function toast_acquisition.continue_job(
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
      last_dispatched_at = null,
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

create or replace function toast_acquisition.restart_token_cursor_job(
  p_job_id bigint,
  p_capability_token uuid,
  p_cursor jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare next_token uuid := gen_random_uuid();
begin
  if jsonb_typeof(p_cursor) <> 'object'
    or p_cursor ? 'pageToken' or p_cursor ? 'page' then
    raise exception 'Restart cursor must not contain pagination state';
  end if;
  update toast_acquisition.jobs as job
  set status = 'pending', cursor = p_cursor,
      next_attempt_at = now(), lease_expires_at = null,
      last_dispatched_at = null,
      capability_token = next_token,
      pagination_generation = pagination_generation + 1
  where job.job_id = p_job_id
    and job.capability_token = p_capability_token
    and job.status = 'running' and job.lease_expires_at > now()
    and job.cursor ? 'pageToken'
    and exists (
      select 1 from toast_acquisition.operations as operation
      where operation.operation_key = job.operation_key
        and operation.pagination_kind = 'cursor' and operation.is_enabled
    );
  if not found then
    raise exception 'Token cursor restart lease is invalid';
  end if;
  return next_token;
end;
$$;

revoke all on function toast_acquisition.continue_job(bigint, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function toast_acquisition.restart_token_cursor_job(
  bigint, uuid, jsonb
) from public, anon, authenticated;
