-- service-owner: momi-event-routing

create function momi_events.emit_toast_webhook_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into momi_events.events (
    event_name, idempotency_key, occurred_at, schema_version,
    source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'source.toast.webhook.' || replace(new.subscription_key, '-', '_') || '.observed',
    'toast:webhook:' || new.event_guid,
    new.source_occurred_at,
    1,
    'toast',
    'webhook.' || new.subscription_key,
    new.event_guid,
    jsonb_build_object(
      'schema', 'toast_raw', 'table', 'webhook_events', 'id', new.id
    ),
    new.correlation_id
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

create trigger emit_toast_webhook_event
after insert on toast_raw.webhook_events
for each row execute function momi_events.emit_toast_webhook_event();

create function momi_events.emit_toast_resource_observation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare source_version toast_raw.resource_versions;
begin
  select * into strict source_version
  from toast_raw.resource_versions
  where resource_version_id = new.resource_version_id;
  insert into momi_events.events (
    event_name, idempotency_key, occurred_at, schema_version,
    source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'source.toast.resource.' || source_version.resource_type || '.observed',
    'toast:resource-observation:' || new.observation_id,
    new.observed_at,
    1,
    'toast',
    source_version.resource_type,
    source_version.source_id,
    jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', new.observation_id,
      'resource_version_id', new.resource_version_id
    ),
    new.correlation_id
  );
  return new;
end;
$$;

create trigger emit_toast_resource_observation
after insert on toast_raw.resource_observations
for each row execute function momi_events.emit_toast_resource_observation();

revoke all on function momi_events.emit_toast_webhook_event()
  from public, anon, authenticated;
revoke all on function momi_events.emit_toast_resource_observation()
  from public, anon, authenticated;
