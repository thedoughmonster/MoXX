-- service-owner: warehouse-projection

create function warehouse_projection.project_and_ack_delivery(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acknowledged boolean;
  projection_result text;
begin
  perform 1
  from momi_events.deliveries as delivery
  where delivery.subscription_key = 'warehouse-projection-toast-v1'
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > now()
  for update;
  if not found then raise exception 'delivery_not_claimed'; end if;

  projection_result := warehouse_projection.project_toast_event(p_event_id);
  if not (
    projection_result in (
      'acquisition_enqueued', 'acquisition_already_enqueued',
      'menu_refresh_enqueued', 'publication_not_advanced'
    )
    or projection_result ~ '^projected(_[a-z0-9_]+)?$'
    or projection_result ~ '^ignored_[a-z0-9_]+$'
  ) then raise exception 'unexpected_projection_outcome'; end if;

  select momi_events.ack_delivery(
    'warehouse-projection-toast-v1', p_event_id,
    p_message_id, p_capability_token
  ) into acknowledged;
  if not coalesce(acknowledged, false) then
    raise exception 'acknowledgement_failed';
  end if;
  return projection_result;
end;
$$;

comment on function warehouse_projection.project_and_ack_delivery(
  uuid, bigint, uuid
) is 'Projects and acknowledges one locked delivery atomically.';

revoke all on function warehouse_projection.project_and_ack_delivery(
  uuid, bigint, uuid
) from public, anon, authenticated;
