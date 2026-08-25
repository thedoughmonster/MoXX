alter table toast_hydration.order_hydration_jobs
  add column trigger_token uuid not null default gen_random_uuid(),
  add constraint order_hydration_jobs_trigger_token_unique
    unique (trigger_token);

alter table toast_hydration.order_api_invocation_work
  add column trigger_token uuid not null default gen_random_uuid(),
  add constraint order_api_work_trigger_token_unique
    unique (trigger_token);

comment on column toast_hydration.order_hydration_jobs.trigger_token is
  'Private capability used only by an allowlisted trigger adapter.';

comment on column toast_hydration.order_api_invocation_work.trigger_token is
  'Private capability used only by an allowlisted trigger adapter.';
