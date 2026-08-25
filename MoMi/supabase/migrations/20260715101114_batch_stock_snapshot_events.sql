-- service-owner: momi-event-routing

create or replace function momi_events.emit_toast_resource_observation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_version toast_raw.resource_versions;
begin
  select * into strict source_version
  from toast_raw.resource_versions
  where resource_version_id = new.resource_version_id;

  if source_version.resource_type = 'stock_state' then
    return new;
  end if;

  insert into momi_events.events (
    event_name, idempotency_key, occurred_at, schema_version,
    source_system, source_resource_type, source_id,
    source_reference, correlation_id
  ) values (
    'source.toast.resource.' || source_version.resource_type || '.observed',
    'toast:resource-observation:' || new.observation_id,
    new.observed_at, 1, 'toast', source_version.resource_type,
    source_version.source_id,
    jsonb_build_object(
      'schema', 'toast_raw', 'table', 'resource_observations',
      'id', new.observation_id,
      'resource_version_id', new.resource_version_id
    ),
    new.correlation_id
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

revoke all on function momi_events.emit_toast_resource_observation()
  from public, anon, authenticated;

comment on function momi_events.emit_toast_resource_observation() is
  'Emits one event per non-stock resource; stock is emitted once per job.';
