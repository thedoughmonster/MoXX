-- service-owner: toast-data-acquisition

create function toast_raw.reject_archive_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'webhook_events'
    and tg_op = 'UPDATE'
    and old.raw_body is null and not old.raw_body_exact
    and new.raw_body is not null and new.raw_body_exact
    and to_jsonb(new) - 'raw_body' - 'raw_body_exact'
      = to_jsonb(old) - 'raw_body' - 'raw_body_exact' then
    return new;
  end if;
  if tg_table_name = 'api_request_attempts'
    and tg_op = 'UPDATE'
    and (
      old.finished_at is null
      or to_jsonb(new) - 'error_code' - 'error_message'
        = to_jsonb(old) - 'error_code' - 'error_message'
    ) then
    return new;
  end if;
  raise exception 'Archived source row %.% is immutable', tg_table_schema, tg_table_name
    using errcode = '55000';
end;
$$;

create trigger preserve_completed_api_request_attempts
before update or delete on toast_raw.api_request_attempts
for each row execute function toast_raw.reject_archive_mutation();

create trigger preserve_toast_resource_versions
before update or delete on toast_raw.resource_versions
for each row execute function toast_raw.reject_archive_mutation();

create trigger preserve_toast_resource_observations
before update or delete on toast_raw.resource_observations
for each row execute function toast_raw.reject_archive_mutation();

create trigger preserve_toast_webhook_events
before update or delete on toast_raw.webhook_events
for each row execute function toast_raw.reject_archive_mutation();

revoke all on function toast_raw.reject_archive_mutation()
  from public, anon, authenticated;
