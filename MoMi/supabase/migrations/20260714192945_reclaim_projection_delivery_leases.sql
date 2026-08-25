-- service-owner: warehouse-projection

create function warehouse_projection.rotate_projection_delivery_capability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'queued' and (
    old.status is distinct from new.status
    or old.queue_message_id is distinct from new.queue_message_id
  ) then
    new.capability_token := gen_random_uuid();
  end if;
  return new;
end;
$$;

create trigger rotate_projection_delivery_capability
before update of status, queue_message_id on momi_events.deliveries
for each row
when (new.subscription_key = 'warehouse-projection-toast-v1')
execute function
  warehouse_projection.rotate_projection_delivery_capability();

comment on function
  warehouse_projection.rotate_projection_delivery_capability() is
  'Rotates projection delivery authority when core queues or requeues work.';

revoke all on function
  warehouse_projection.rotate_projection_delivery_capability()
  from public, anon, authenticated;
