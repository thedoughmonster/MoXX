-- service-owner: warehouse-read-api

create table momi_api.beta_query_capabilities (
  capability_id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null,
  gateway_invocation_id uuid not null,
  query_kind text not null check (query_kind in (
    'order', 'payment', 'menu', 'schedule', 'stock'
  )),
  subject_entity_id uuid not null,
  scope_entity_id uuid,
  capability_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  consumed_at timestamptz,
  constraint beta_query_scope_valid check (
    (query_kind = 'stock' and scope_entity_id is not null)
    or (query_kind <> 'stock' and scope_entity_id is null)
  ),
  constraint beta_query_lifetime_valid check (expires_at > created_at)
);

create index beta_query_capabilities_active_idx
  on momi_api.beta_query_capabilities (gateway_invocation_id, capability_id)
  where consumed_at is null;

create function momi_api.issue_beta_query_capability_v1(
  p_requester_user_id uuid, p_gateway_invocation_id uuid, p_query_kind text,
  p_subject_entity_id uuid, p_scope_entity_id uuid default null
)
returns table (capability_id uuid, capability_token uuid, expires_at timestamptz)
language sql security definer set search_path = '' as $$
  insert into momi_api.beta_query_capabilities (
    requester_user_id, gateway_invocation_id, query_kind,
    subject_entity_id, scope_entity_id
  ) values (p_requester_user_id, p_gateway_invocation_id, p_query_kind,
    p_subject_entity_id, p_scope_entity_id)
  returning momi_api.beta_query_capabilities.capability_id,
    momi_api.beta_query_capabilities.capability_token,
    momi_api.beta_query_capabilities.expires_at
$$;

create function momi_api.consume_beta_query_capability_v1(
  p_capability_id uuid, p_capability_token uuid,
  p_requester_user_id uuid, p_gateway_invocation_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  capability momi_api.beta_query_capabilities%rowtype;
  result jsonb;
begin
  update momi_api.beta_query_capabilities set consumed_at = now()
  where capability_id = p_capability_id
    and capability_token = p_capability_token
    and requester_user_id = p_requester_user_id
    and gateway_invocation_id = p_gateway_invocation_id
    and consumed_at is null and expires_at > now()
  returning * into capability;
  if not found then return null; end if;
  if capability.query_kind = 'stock' then
    select jsonb_build_object(
      'contract', 'momi.canonical_beta_query.v1',
      'query_kind', capability.query_kind,
      'item_id', stock.item_entity_id,
      'location_id', stock.location_entity_id,
      'observed_at', stock.observed_at,
      'stock_state', stock.stock_state,
      'quantity', stock.quantity,
      'provenance', stock.provenance,
      'freshness', stock.freshness
    ) into result from momi_api.stock_observations_latest_v1 stock
    where stock.item_entity_id = capability.subject_entity_id
      and stock.location_entity_id = capability.scope_entity_id;
  else
    select jsonb_build_object(
      'contract', 'momi.canonical_beta_query.v1',
      'query_kind', capability.query_kind,
      'entity_id', entity.entity_id,
      'entity_type', entity.entity_type,
      'schema_version', entity.schema_version,
      'document', entity.canonical_document,
      'provenance', entity.provenance,
      'freshness', entity.freshness
    ) into result from momi_api.warehouse_entities_by_id_v1 entity
    where entity.entity_id = capability.subject_entity_id
      and (
        (capability.query_kind = 'order' and entity.entity_type = 'order')
        or (capability.query_kind = 'payment' and entity.entity_type = 'payment')
        or (capability.query_kind = 'schedule' and entity.entity_type = 'schedule')
        or (capability.query_kind = 'menu' and entity.entity_type in (
          'menu', 'menu_group', 'menu_item', 'modifier_group', 'modifier_option'
        ))
      );
  end if;
  return result;
end;
$$;

comment on table momi_api.beta_query_capabilities is
  'Expiring one-use authorization for one allowlisted communications beta canonical read.';
alter table momi_api.beta_query_capabilities enable row level security;
revoke all on table momi_api.beta_query_capabilities from public, anon, authenticated;
revoke all on function momi_api.issue_beta_query_capability_v1(uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function momi_api.consume_beta_query_capability_v1(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function momi_api.issue_beta_query_capability_v1(uuid, uuid, text, uuid, uuid)
  to service_role;
grant execute on function momi_api.consume_beta_query_capability_v1(uuid, uuid, uuid, uuid)
  to service_role;
