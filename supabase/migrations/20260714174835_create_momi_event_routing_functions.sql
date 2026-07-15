-- service-owner: momi-event-routing

create function momi_events.enqueue_routing_work()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into momi_events.routing_work (event_id)
  values (new.event_id)
  on conflict (event_id) do nothing;
  return new;
end;
$$;

create trigger enqueue_event_routing_work
after insert on momi_events.events
for each row execute function momi_events.enqueue_routing_work();

create function momi_events.claim_routing_work(p_limit integer default 25)
returns table (event_id uuid, capability_token uuid)
language sql
security invoker
set search_path = ''
as $$
  with claimable as (
    select work.event_id
    from momi_events.routing_work as work
    where work.attempt_count < 12
      and work.next_attempt_at <= now()
      and (
        work.status in ('pending', 'retry_wait')
        or (work.status = 'running' and work.lease_expires_at <= now())
      )
    order by work.next_attempt_at, work.event_id
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update momi_events.routing_work as work
  set status = 'running',
      attempt_count = work.attempt_count + 1,
      lease_expires_at = now() + interval '120 seconds',
      capability_token = gen_random_uuid(),
      last_error = null
  from claimable
  where work.event_id = claimable.event_id
  returning work.event_id, work.capability_token;
$$;

create function momi_events.fail_routing_work(
  p_event_id uuid,
  p_capability_token uuid,
  p_error text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attempts integer;
begin
  select attempt_count into attempts
  from momi_events.routing_work
  where event_id = p_event_id
    and capability_token = p_capability_token
    and status = 'running'
  for update;
  if not found then return false; end if;
  update momi_events.routing_work
  set status = case when attempts >= 12 then 'dead_letter' else 'retry_wait' end,
      next_attempt_at = now() + make_interval(
        secs => least(3600, 15 * power(2, greatest(0, attempts - 1))::integer)
      ),
      lease_expires_at = null,
      last_error = left(p_error, 4000)
  where event_id = p_event_id;
  return true;
end;
$$;

create function momi_events.claim_routing_work_item(
  p_event_id uuid,
  p_capability_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  update momi_events.routing_work
  set status = 'running', attempt_count = attempt_count + 1,
      lease_expires_at = now() + interval '120 seconds',
      last_error = null
  where event_id = p_event_id
    and capability_token = p_capability_token
    and attempt_count < 12
    and next_attempt_at <= now()
    and (
      status in ('pending', 'retry_wait')
      or (status = 'running' and lease_expires_at <= now())
    )
  returning true;
$$;

revoke all on function momi_events.enqueue_routing_work()
  from public, anon, authenticated;
revoke all on function momi_events.claim_routing_work(integer)
  from public, anon, authenticated;
revoke all on function momi_events.fail_routing_work(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function momi_events.claim_routing_work_item(uuid, uuid)
  from public, anon, authenticated;
