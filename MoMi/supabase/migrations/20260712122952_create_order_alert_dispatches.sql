create table toast_alerting.order_alert_dispatches (
  raw_event_id bigint primary key
    references toast_raw.order_webhook_events(id),
  queued_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  last_outcome jsonb not null default '{}'::jsonb,
  constraint order_alert_dispatches_attempt_count_is_valid
    check (attempt_count >= 0),
  constraint order_alert_dispatches_outcome_is_object
    check (jsonb_typeof(last_outcome) = 'object')
);
create index order_alert_dispatches_pending_idx
  on toast_alerting.order_alert_dispatches (queued_at)
  where completed_at is null;
alter table toast_alerting.order_alert_dispatches enable row level security;
revoke all on toast_alerting.order_alert_dispatches
  from public, anon, authenticated;

create function toast_alerting.enqueue_order_alert_dispatch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into toast_alerting.order_alert_dispatches (raw_event_id)
  values (new.id)
  on conflict (raw_event_id) do nothing;
  return new;
end;
$$;
revoke all on function toast_alerting.enqueue_order_alert_dispatch()
  from public, anon, authenticated;
create trigger enqueue_order_alert_dispatch
after insert on toast_raw.order_webhook_events
for each row execute function toast_alerting.enqueue_order_alert_dispatch();

create function toast_alerting.process_order_alert_dispatch(
  input_raw_event_id bigint
)
returns table (
  event_found boolean,
  matched_count integer,
  ambiguous_count integer,
  claimed_count integer,
  candidate_ids jsonb,
  was_already_completed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dispatch_row toast_alerting.order_alert_dispatches%rowtype;
  claim_row record;
begin
  insert into toast_alerting.order_alert_dispatches (raw_event_id)
  select event.id
  from toast_raw.order_webhook_events as event
  where event.id = input_raw_event_id
  on conflict (raw_event_id) do nothing;

  select dispatch.* into dispatch_row
  from toast_alerting.order_alert_dispatches as dispatch
  where dispatch.raw_event_id = input_raw_event_id
  for update;

  if not found then
    return query select false, 0, 0, 0, '[]'::jsonb, false;
    return;
  end if;

  if dispatch_row.completed_at is not null then
    return query select
      true,
      coalesce((dispatch_row.last_outcome ->> 'matched_count')::integer, 0),
      coalesce((dispatch_row.last_outcome ->> 'ambiguous_count')::integer, 0),
      coalesce((dispatch_row.last_outcome ->> 'claimed_count')::integer, 0),
      coalesce(dispatch_row.last_outcome -> 'candidate_ids', '[]'::jsonb),
      true;
    return;
  end if;

  update toast_alerting.order_alert_dispatches as dispatch
  set attempt_count = dispatch.attempt_count + 1,
      last_attempt_at = now(),
      last_error = null
  where dispatch.raw_event_id = input_raw_event_id;

  select claim.* into claim_row
  from toast_alerting.claim_order_alert_candidates(input_raw_event_id) as claim;

  update toast_alerting.order_alert_dispatches as dispatch
  set completed_at = now(),
      last_outcome = jsonb_build_object(
        'event_found', claim_row.event_found,
        'matched_count', claim_row.matched_count,
        'ambiguous_count', claim_row.ambiguous_count,
        'claimed_count', claim_row.claimed_count,
        'candidate_ids', claim_row.candidate_ids
      )
  where dispatch.raw_event_id = input_raw_event_id;

  return query select
    claim_row.event_found,
    claim_row.matched_count,
    claim_row.ambiguous_count,
    claim_row.claimed_count,
    claim_row.candidate_ids,
    false;
end;
$$;
revoke all on function toast_alerting.process_order_alert_dispatch(bigint)
  from public, anon, authenticated;
