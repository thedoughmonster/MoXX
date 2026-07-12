alter table toast_hydration.order_api_invocation_work
  add column not_before timestamptz not null default now(),
  add column started_at timestamptz,
  add column lease_expires_at timestamptz;

drop index toast_hydration.order_api_invocation_work_pending_idx;

create index order_api_invocation_work_claim_idx
  on toast_hydration.order_api_invocation_work (
    status,
    not_before,
    lease_expires_at,
    created_at
  );
