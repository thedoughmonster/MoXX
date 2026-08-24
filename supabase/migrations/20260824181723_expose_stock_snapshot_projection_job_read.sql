-- service-owner: toast-data-acquisition

create function toast_acquisition.read_stock_snapshot_projection_job_v1(
  p_job_id bigint
)
returns table (
  job_id bigint,
  operation_key text,
  status text,
  mode text,
  restaurant_guid text
)
language sql
stable
security definer
set search_path = ''
as $$
  select job.job_id, job.operation_key, job.status, job.mode,
    job.restaurant_guid
  from toast_acquisition.jobs as job
  where job.job_id = p_job_id;
$$;

comment on function
  toast_acquisition.read_stock_snapshot_projection_job_v1(bigint) is
  'Exact acquisition job envelope required by stock snapshot projection.';

revoke all on function
  toast_acquisition.read_stock_snapshot_projection_job_v1(bigint)
  from public, anon, authenticated, service_role;
grant execute on function
  toast_acquisition.read_stock_snapshot_projection_job_v1(bigint)
  to svc_warehouse_projection;
