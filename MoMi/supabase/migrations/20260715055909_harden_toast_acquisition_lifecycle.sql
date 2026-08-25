-- service-owner: toast-data-acquisition

alter table toast_acquisition.coverage_windows
  drop constraint coverage_status_valid;
alter table toast_acquisition.coverage_windows
  add constraint coverage_status_valid check (
    coverage_status in (
      'complete', 'empty', 'partial', 'gap', 'accepted_gap', 'dead_letter'
    )
  );

create function toast_acquisition.restart_token_cursor_job(
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
      capability_token = next_token
  where job.job_id = p_job_id
    and job.capability_token = p_capability_token
    and job.status = 'running' and job.lease_expires_at > now()
    and job.cursor ? 'pageToken'
    and exists (
      select 1 from toast_acquisition.operations as operation
      where operation.operation_key = job.operation_key
        and operation.pagination_kind = 'cursor' and operation.is_enabled
    );
  if not found then raise exception 'Token cursor restart lease is invalid'; end if;
  return next_token;
end;
$$;

revoke all on function toast_acquisition.restart_token_cursor_job(
  bigint, uuid, jsonb
) from public, anon, authenticated;
