-- service-owner: toast-data-acquisition

create table toast_acquisition.jobs (
  job_id bigint generated always as identity primary key,
  operation_key text not null
    references toast_acquisition.operations(operation_key),
  source_key text not null default 'toast',
  restaurant_guid text not null,
  mode text not null,
  window_start timestamptz,
  window_end timestamptz,
  cursor jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  reason text not null,
  correlation_id uuid not null,
  idempotency_key text not null unique,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  page_count integer not null default 0,
  page_budget integer not null default 1000,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  capability_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  constraint jobs_restaurant_fk foreign key (source_key, restaurant_guid)
    references toast_acquisition.restaurants(source_key, restaurant_guid),
  constraint jobs_mode_valid check (
    mode in ('live', 'snapshot', 'backfill', 'repair', 'reconcile')
  ),
  constraint jobs_window_order check (
    window_start is null or window_end is null or window_end > window_start
  ),
  constraint jobs_cursor_object check (jsonb_typeof(cursor) = 'object'),
  constraint jobs_parameters_object check (jsonb_typeof(parameters) = 'object'),
  constraint jobs_reason_present check (nullif(reason, '') is not null),
  constraint jobs_idempotency_present
    check (nullif(idempotency_key, '') is not null),
  constraint jobs_status_valid check (
    status in ('pending', 'running', 'retry_wait', 'succeeded', 'dead_letter')
  ),
  constraint jobs_attempt_count_valid check (attempt_count between 0 and 12),
  constraint jobs_page_budget_valid check (
    page_budget between 1 and 10000 and page_count between 0 and page_budget
  )
);

create function toast_acquisition.require_repair_for_exact_resource()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.mode <> 'repair' and exists (
    select 1 from toast_acquisition.operations as operation
    where operation.operation_key = new.operation_key
      and operation.exact_resource_only
  ) then
    raise exception 'Exact-resource jobs require repair mode'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_exact_resource_repair_mode
before insert or update of operation_key, mode on toast_acquisition.jobs
for each row execute function
  toast_acquisition.require_repair_for_exact_resource();

create index acquisition_jobs_claim_idx on toast_acquisition.jobs (
  status, next_attempt_at, lease_expires_at, created_at
);
create index acquisition_jobs_operation_idx on toast_acquisition.jobs (
  operation_key, restaurant_guid, created_at desc
);

create table toast_acquisition.coverage_windows (
  coverage_id uuid primary key default gen_random_uuid(),
  operation_key text not null
    references toast_acquisition.operations(operation_key),
  restaurant_guid text not null,
  window_start timestamptz,
  window_end timestamptz,
  coverage_status text not null,
  page_count integer not null default 0,
  record_count bigint not null default 0,
  checked_at timestamptz not null default now(),
  notes text,
  constraint coverage_status_valid
    check (coverage_status in ('complete', 'empty', 'partial', 'gap', 'accepted_gap')),
  constraint coverage_counts_valid check (page_count >= 0 and record_count >= 0)
);

create index coverage_windows_lookup_idx on toast_acquisition.coverage_windows (
  operation_key, restaurant_guid, window_start, window_end
);

alter table toast_acquisition.jobs enable row level security;
alter table toast_acquisition.coverage_windows enable row level security;
revoke all on all tables in schema toast_acquisition
  from public, anon, authenticated;
revoke all on all sequences in schema toast_acquisition
  from public, anon, authenticated;
revoke all on function toast_acquisition.require_repair_for_exact_resource()
  from public, anon, authenticated;
