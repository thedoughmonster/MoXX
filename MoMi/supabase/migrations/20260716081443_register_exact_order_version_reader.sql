-- service-owner: warehouse-read-api

create view momi_api.order_versions_by_id_v1
with (security_invoker = true)
as
select version.entity_version_id as order_version_id,
  version.entity_id as order_id,
  version.schema_version,
  version.canonical_document as order_document,
  version.canonical_document -> 'presentation' as order_presentation,
  version.provenance,
  jsonb_build_object(
    'observed_at', version.source_observed_at,
    'projected_at', version.projected_at,
    'age_seconds', greatest(
      0, extract(epoch from now() - version.source_observed_at)::bigint
    )
  ) as freshness
from momi_warehouse.entity_versions as version
join momi_warehouse.entities as entity using (entity_id)
where entity.entity_type = 'order'
  and entity.lifecycle_status = 'active';

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'momi.orders.get_by_version.v1', 1, 'read', true,
  'warehouse-read-api',
  '46c4433394c2eb44e9c3df03f0cd349f002f879d90bb8a1c00f7add275168f8d'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('momi.orders.get_by_version.v1', 'work_id', 'work_id',
    'body', true, 'string', false, false, 1),
  ('momi.orders.get_by_version.v1', 'order_id', 'order_id',
    'body', true, 'uuid', false, true, 2),
  ('momi.orders.get_by_version.v1', 'order_version_id',
    'order_version_id', 'body', true, 'uuid', false, true, 3),
  ('momi.orders.get_by_version.v1', 'capability_token',
    'capability_token', 'body', true, 'uuid', false, false, 4);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'momi.orders.get_by_version.http.v1',
  'momi.orders.get_by_version.v1', 1, 'durable_http',
  'POST', '/functions/v1/momi-orders-get-by-version-v1',
  'durable.read_capability.v1', true, 'warehouse-read-api'
);

insert into momi_api.read_view_registry (
  view_key, contract_version, schema_name, view_or_function_name,
  parameter_contract, result_contract, active, owner_service
) values (
  'momi.orders.get_by_version.v1', 1, 'momi_api',
  'order_versions_by_id_v1',
  '{"entity_type":"order","id_type":"uuid","version_id_type":"uuid"}',
  '{"document":"order_document","exact_version":true,"provenance":true}',
  true, 'warehouse-read-api'
);

comment on view momi_api.order_versions_by_id_v1 is
  'Exact immutable canonical Dough Monster order versions.';

revoke all on table momi_api.order_versions_by_id_v1
  from public, anon, authenticated;

alter table momi_api.read_capabilities
  drop constraint order_read_capabilities_are_bound,
  add column subject_version_id uuid
    references momi_warehouse.entity_versions(entity_version_id),
  add constraint order_read_capabilities_are_bound check (
    function_key not in (
      'momi.orders.get_by_id.v1',
      'momi.orders.get_by_version.v1'
    ) or binding_key <> 'unbound'
  ),
  add constraint exact_order_read_capabilities_are_versioned check (
    function_key <> 'momi.orders.get_by_version.v1'
    or subject_version_id is not null
  );

create index read_capabilities_version_idx
  on momi_api.read_capabilities (
    function_key, subject_entity_id, subject_version_id, id
  )
  where revoked_at is null and consumed_at is null
    and subject_version_id is not null;

create function momi_api.consume_versioned_read_capability(
  p_id bigint,
  p_function_key text,
  p_subject_entity_id uuid,
  p_subject_version_id uuid,
  p_capability_token uuid
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  with consumed as (
    update momi_api.read_capabilities as capability
    set consumed_at = now()
    where capability.id = p_id
      and p_function_key = 'momi.orders.get_by_version.v1'
      and capability.function_key = p_function_key
      and capability.subject_entity_id = p_subject_entity_id
      and capability.subject_version_id = p_subject_version_id
      and capability.scope_entity_id is null
      and capability.capability_token = p_capability_token
      and capability.revoked_at is null
      and capability.consumed_at is null
      and capability.expires_at > now()
      and capability.binding_key = 'momi.order_alert_delivery.v1'
      and exists (
        select 1
        from momi_alerting.order_read_capability_uses as binding
        join momi_orders.api_invocation_attempts as attempt
          on attempt.id = binding.attempt_id
          and attempt.work_id = binding.api_work_id
        join momi_orders.api_invocation_work as work
          on work.id = binding.api_work_id
        join momi_alerting.order_event_bridges as bridge
          on bridge.api_work_id = work.id
          and bridge.event_id = binding.event_id
          and bridge.event_name = 'warehouse.order.observed'
        join momi_events.deliveries as delivery
          on delivery.event_id = binding.event_id
          and delivery.subscription_key = 'order-alerting-v1'
          and delivery.queue_message_id = binding.queue_message_id
        where binding.read_capability_id = capability.id
          and binding.revoked_at is null
          and attempt.outcome = 'running'
          and attempt.finished_at is null
          and work.status = 'running'
          and work.lease_expires_at > now()
          and work.api_contract_key = p_function_key
          and work.order_id::uuid = p_subject_entity_id
          and work.source_version_id = p_subject_version_id::text
          and bridge.warehouse_version_id = p_subject_version_id
          and delivery.status = 'running'
          and delivery.lease_expires_at > now()
      )
    returning capability.id::text as work_id
  )
  select work_id from consumed;
$$;

comment on function momi_api.consume_versioned_read_capability(
  bigint, text, uuid, uuid, uuid
) is 'Consumes one capability bound to an exact canonical order version.';

revoke all on function momi_api.consume_versioned_read_capability(
  bigint, text, uuid, uuid, uuid
) from public, anon, authenticated;
