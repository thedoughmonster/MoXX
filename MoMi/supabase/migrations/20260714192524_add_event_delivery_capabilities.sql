-- service-owner: momi-event-routing

alter table momi_events.deliveries
  add column if not exists capability_token uuid
  not null default gen_random_uuid();

comment on column momi_events.deliveries.capability_token is
  'Rotating per-delivery token carried only with the exact wake identity.';

do $$
begin
  if to_regprocedure(
    'momi_events.begin_delivery(text,uuid,bigint,uuid)'
  ) is null or to_regprocedure(
    'momi_events.ack_delivery(text,uuid,bigint,uuid)'
  ) is null or to_regprocedure(
    'momi_events.fail_delivery(text,uuid,bigint,uuid,text)'
  ) is null then
    raise exception 'Capability-fenced delivery lifecycle is incomplete';
  end if;
end;
$$;
