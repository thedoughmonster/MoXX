-- service-owner: warehouse-read-api

alter table momi_archive.export_runs
  add column export_kind text not null default 'legacy';

alter table momi_archive.export_runs
  alter column export_kind set default 'monthly',
  add constraint export_runs_kind_valid check (
    export_kind in (
      'legacy', 'monthly', 'pre_deadline', 'pre_closure', 'ad_hoc'
    )
  ),
  add constraint export_runs_size_required
    check (byte_size is not null) not valid,
  add constraint export_runs_operator_present
    check (nullif(operator_name, '') is not null) not valid,
  add constraint export_runs_path_present
    check (nullif(archive_path, '') is not null) not valid,
  add constraint export_runs_time_valid
    check (exported_at <= recorded_at + interval '5 minutes') not valid;

create function momi_archive.reject_export_run_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Manual export evidence is append-only'
    using errcode = '55000';
end;
$$;

create trigger preserve_manual_export_evidence
before update or delete on momi_archive.export_runs
for each row execute function momi_archive.reject_export_run_mutation();

create trigger preserve_manual_export_evidence_table
before truncate on momi_archive.export_runs
for each statement execute function momi_archive.reject_export_run_mutation();

create view momi_archive.product_export_status_v1
with (security_invoker = true)
as
select gap.product_key, gap.source_system, gap.product_name,
  gap.gap_description, gap.export_method, gap.cadence_days, gap.active,
  latest.export_run_id, latest.export_kind,
  latest.exported_at as last_export_at,
  latest.operator_name, latest.archive_path, latest.sha256,
  latest.byte_size, latest.recorded_at,
  due.effective_next_due_at,
  gap.active and gap.cadence_days is not null
    and coalesce(due.effective_next_due_at <= now(),
      latest.export_run_id is null) as export_due
from momi_archive.product_gap_register as gap
left join lateral (
  select run.export_run_id, run.export_kind, run.exported_at,
    run.operator_name, run.archive_path, run.sha256,
    run.byte_size, run.recorded_at
  from momi_archive.export_runs as run
  where run.product_key = gap.product_key
    and run.byte_size is not null
    and nullif(run.operator_name, '') is not null
    and nullif(run.archive_path, '') is not null
    and run.exported_at <= run.recorded_at + interval '5 minutes'
  order by run.exported_at desc, run.recorded_at desc, run.export_run_id desc
  limit 1
) as latest on true
cross join lateral (
  select case
    when latest.export_run_id is null then gap.next_due_at
    when gap.next_due_at > latest.exported_at then least(
      gap.next_due_at,
      latest.exported_at + make_interval(days => gap.cadence_days)
    )
    when gap.cadence_days is not null then latest.exported_at
      + make_interval(days => gap.cadence_days)
    else null end as effective_next_due_at
) as due;

create view momi_archive.manual_export_findings_v1
with (security_invoker = true)
as
select 'MANUAL_EXPORT_DUE'::text as finding_code,
  'product_gap'::text as record_type,
  status.product_key as record_key,
  coalesce(status.effective_next_due_at, now()) as found_at,
  jsonb_build_object('product_name', status.product_name,
    'export_method', status.export_method,
    'last_export_at', status.last_export_at) as details
from momi_archive.product_export_status_v1 as status
where status.export_due
union all
select 'MANUAL_EXPORT_EVIDENCE_INVALID', 'export_run',
  run.export_run_id::text, run.recorded_at,
  jsonb_build_object('product_key', run.product_key,
    'archive_path', run.archive_path)
from momi_archive.export_runs as run
where run.byte_size is null or nullif(run.operator_name, '') is null
  or nullif(run.archive_path, '') is null
  or run.exported_at > run.recorded_at + interval '5 minutes';

revoke all on function momi_archive.reject_export_run_mutation()
  from public, anon, authenticated;
revoke all on momi_archive.product_export_status_v1,
  momi_archive.manual_export_findings_v1
  from public, anon, authenticated;

comment on view momi_archive.product_export_status_v1 is
  'Manual export status derived from immutable run evidence.';
