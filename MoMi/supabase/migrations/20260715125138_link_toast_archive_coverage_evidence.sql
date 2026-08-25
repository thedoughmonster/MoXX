-- service-owner: toast-data-acquisition

alter table toast_acquisition.jobs
  add column coverage_policy_version text not null
    default 'toast-exit-archive-v1' references
      toast_acquisition.coverage_policy_versions(policy_version),
  add column pagination_generation integer not null default 1,
  add constraint jobs_pagination_generation_valid
    check (pagination_generation > 0);

alter table toast_raw.api_request_attempts
  add column pagination_generation integer not null default 1,
  add constraint api_attempt_pagination_generation_valid
    check (pagination_generation > 0);

alter table toast_acquisition.coverage_windows
  add column job_id bigint references toast_acquisition.jobs(job_id),
  add column coverage_policy_version text not null
    default 'toast-exit-archive-v1' references
      toast_acquisition.coverage_policy_versions(policy_version),
  add column coverage_dimensions jsonb not null default '{}'::jsonb,
  add column terminal_attempt_id uuid references
    toast_raw.api_request_attempts(attempt_id),
  add column pagination_generation integer not null default 1,
  add constraint coverage_dimensions_object
    check (jsonb_typeof(coverage_dimensions) = 'object'),
  add constraint coverage_pagination_generation_valid
    check (pagination_generation > 0);

create index coverage_windows_job_idx
  on toast_acquisition.coverage_windows (job_id, checked_at desc)
  where job_id is not null;

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

create function toast_acquisition.reject_coverage_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Coverage evidence %.% is immutable',
    tg_table_schema, tg_table_name using errcode = '55000';
end;
$$;

create trigger preserve_coverage_evidence
before update or delete on toast_acquisition.coverage_windows
for each row execute function toast_acquisition.reject_coverage_mutation();

revoke all on function toast_acquisition.restart_token_cursor_job(
  bigint, uuid, jsonb
) from public, anon, authenticated;
revoke all on function toast_acquisition.reject_coverage_mutation()
  from public, anon, authenticated;
