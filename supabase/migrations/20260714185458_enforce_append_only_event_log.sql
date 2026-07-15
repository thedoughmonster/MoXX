-- service-owner: momi-event-routing

create function momi_events.reject_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Event history is append-only' using errcode = '55000';
end;
$$;

create trigger preserve_momi_event_history
before update or delete on momi_events.events
for each row execute function momi_events.reject_event_mutation();

revoke all on function momi_events.reject_event_mutation()
  from public, anon, authenticated;
