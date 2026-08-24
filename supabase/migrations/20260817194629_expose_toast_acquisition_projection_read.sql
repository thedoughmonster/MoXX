-- service-owner: toast-data-acquisition

create function toast_acquisition.read_projection_job_mode_v1(
  p_job_id bigint
)
returns table (mode text)
language sql
stable
security definer
set search_path = ''
as $$
  select job.mode
  from toast_acquisition.jobs as job
  where job.job_id = p_job_id;
$$;

comment on function toast_acquisition.read_projection_job_mode_v1(bigint) is
  'Narrow v1 warehouse projection read for one acquisition job mode.';

revoke all on function toast_acquisition.read_projection_job_mode_v1(bigint)
  from public, anon, authenticated, service_role;
grant execute on function toast_acquisition.read_projection_job_mode_v1(bigint)
  to svc_warehouse_projection;
