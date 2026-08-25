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
    elsif tg_table_name = 'resource_versions'
      and to_jsonb(new) = to_jsonb(old) then
      return new;
    end if;
  end if;
  raise exception 'Archived source row %.% is immutable',
    tg_table_schema, tg_table_name using errcode = '55000';
end;
$$;

comment on function toast_raw.reject_archive_mutation() is
  'Rejects archive mutation while allowing conflict-returning no-op updates.';

insert into toast_raw.resource_observations (
  resource_version_id, attempt_id, observed_at, page_cursor, correlation_id
)
select version.resource_version_id, attempt.attempt_id,
  attempt.finished_at, attempt.request_cursor, attempt.correlation_id
from toast_raw.api_request_attempts as attempt
join toast_acquisition.jobs as job using (job_id)
join toast_acquisition.operations as operation
  on operation.operation_key = attempt.operation_key
join toast_raw.resource_versions as version
  on version.source_system = 'toast'
  and version.resource_type = operation.resource_type
  and version.restaurant_guid = attempt.restaurant_guid
  and version.payload = attempt.response_json
where attempt.http_status between 200 and 299
  and attempt.error_code is null and attempt.finished_at is not null
  and job.status = 'succeeded'
  and attempt.pagination_generation = job.pagination_generation
  and operation.response_kind = 'document'
  and jsonb_typeof(attempt.response_json) = 'object'
  and not exists (
    select 1 from toast_raw.resource_observations as observation
    where observation.attempt_id = attempt.attempt_id
  );

do $$
begin
  if exists (
    select 1 from toast_acquisition.coverage_ledger_v1 as ledger
    join toast_acquisition.operations as operation using (operation_key)
    where ledger.job_status = 'succeeded'
      and ledger.coverage_status = 'gap'
      and ledger.raw_evidence_complete
      and operation.response_kind = 'document'
  ) then raise exception 'Successful document observations remain missing';
  end if;
end;
$$;
