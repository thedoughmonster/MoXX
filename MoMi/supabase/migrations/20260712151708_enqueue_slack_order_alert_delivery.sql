create function toast_alerting.enqueue_slack_order_alert_delivery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into toast_alerting.slack_delivery_work (candidate_id)
  values (new.id)
  on conflict (candidate_id) do nothing;
  return new;
end;
$$;

comment on function toast_alerting.enqueue_slack_order_alert_delivery()
  is 'Creates durable Slack delivery work after an alert candidate commits.';

revoke all on function toast_alerting.enqueue_slack_order_alert_delivery()
  from public, anon, authenticated;

create trigger enqueue_slack_order_alert_delivery
after insert on toast_alerting.order_alert_candidates
for each row execute function
  toast_alerting.enqueue_slack_order_alert_delivery();
