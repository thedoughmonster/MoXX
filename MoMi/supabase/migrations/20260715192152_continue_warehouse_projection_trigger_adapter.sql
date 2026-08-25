-- service-owner: warehouse-projection

create or replace function warehouse_projection.wake_projection_worker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path text;
  project_url text;
  gateway_key text;
begin
  if tg_op = 'INSERT' then return new; end if;
  if old.status is distinct from new.status
    or old.queue_message_id is distinct from new.queue_message_id
  then return new; end if;
  if exists (
    select 1
    from warehouse_projection.delivery_reservations as reservation
    where reservation.event_id = new.event_id
      and reservation.subscription_key = new.subscription_key
      and reservation.queue_message_id = new.queue_message_id
      and reservation.capability_token = new.capability_token
      and reservation.dispatch_mode = 'internal'
      and reservation.reserved_until > now()
  ) then return new; end if;
  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.warehouse_projection.toast.http.v1'
    and registry.function_key =
      'momi.warehouse_projection.toast.consume.v1'
    and registry.route_path =
      '/functions/v1/momi-warehouse-projection-worker-v1'
    and registry.http_method = 'POST'
    and registry.authentication_policy_key = 'durable.work_token.v1'
    and registry.active;
  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'event_id', new.event_id,
      'message_id', new.queue_message_id::text,
      'capability_token', new.capability_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke all on function warehouse_projection.wake_projection_worker()
  from public, anon, authenticated;
