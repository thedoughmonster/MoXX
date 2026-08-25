alter table toast_alerting.order_alert_candidates
  alter column raw_event_id drop not null,
  add column hydration_job_id bigint not null
    references toast_hydration.order_hydration_jobs(id),
  add column order_version_id bigint not null
    references toast_raw.orders(id),
  add column order_api_work_id bigint not null
    references toast_hydration.order_api_invocation_work(id);

create index order_alert_candidates_hydration_job_idx
  on toast_alerting.order_alert_candidates (hydration_job_id);
create index order_alert_candidates_order_version_idx
  on toast_alerting.order_alert_candidates (order_version_id);
create index order_alert_candidates_order_api_work_idx
  on toast_alerting.order_alert_candidates (order_api_work_id);
