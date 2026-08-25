alter table toast_hydration.order_api_invocation_work
  add column hydration_job_id bigint,
  add column last_outcome jsonb not null default '{}'::jsonb,
  add constraint order_api_work_outcome_object
    check (jsonb_typeof(last_outcome) = 'object');

update toast_hydration.order_api_invocation_work as work
set hydration_job_id = (
  select attempt.job_id
  from toast_hydration.order_hydration_attempts as attempt
  where attempt.order_version_id = work.order_version_id
    and attempt.outcome = 'succeeded'
  order by attempt.started_at, attempt.id
  limit 1
);

do $$
begin
  if exists (
    select 1
    from toast_hydration.order_api_invocation_work
    where hydration_job_id is null
  ) then
    raise exception 'Order API work is missing hydration provenance';
  end if;
end;
$$;

alter table toast_hydration.order_api_invocation_work
  alter column hydration_job_id set not null,
  add constraint order_api_work_hydration_job_fk
    foreign key (hydration_job_id)
    references toast_hydration.order_hydration_jobs(id);

create index order_api_invocation_work_hydration_job_idx
  on toast_hydration.order_api_invocation_work (hydration_job_id);

create table toast_hydration.order_api_invocation_attempts (
  id bigint generated always as identity primary key,
  work_id bigint not null
    references toast_hydration.order_api_invocation_work(id),
  invocation_id uuid not null default gen_random_uuid(),
  code_commit_sha text not null,
  deployment_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'running',
  http_status integer,
  response_metadata jsonb not null default '{}'::jsonb,
  decision_outcome jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  constraint order_api_attempt_invocation_unique unique (invocation_id),
  constraint order_api_attempt_commit_present
    check (nullif(code_commit_sha, '') is not null),
  constraint order_api_attempt_outcome_valid
    check (outcome in ('running', 'succeeded', 'failed')),
  constraint order_api_attempt_response_object
    check (jsonb_typeof(response_metadata) = 'object'),
  constraint order_api_attempt_decision_object
    check (jsonb_typeof(decision_outcome) = 'object')
);

create index order_api_invocation_attempts_work_idx
  on toast_hydration.order_api_invocation_attempts (work_id);

alter table toast_hydration.order_api_invocation_attempts
  enable row level security;

revoke all on table toast_hydration.order_api_invocation_attempts
  from public, anon, authenticated;
revoke all on sequence toast_hydration.order_api_invocation_attempts_id_seq
  from public, anon, authenticated;
