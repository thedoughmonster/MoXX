-- service-owner: order-alerting
-- Includes the transitional pg_net trigger adapter for legacy alert work.

alter table momi_alerting.order_source_mappings
  add column mapping_scope text not null default 'source',
  alter column payload_path drop not null,
  alter column expected_value drop not null,
  alter column order_id_path drop not null,
  alter column source_system drop not null,
  alter column api_contract_key drop not null,
  add constraint order_source_mappings_scope_valid check (
    (mapping_scope = 'source'
      and payload_path is not null
      and expected_value is not null
      and order_id_path is not null
      and nullif(source_system, '') is not null
      and nullif(api_contract_key, '') is not null)
    or (mapping_scope = 'canonical'
      and payload_path is null
      and expected_value is null
      and order_id_path is null
      and source_system is null
      and api_contract_key is null)
  );

alter table momi_alerting.alert_rule_conditions
  add column match_operator text not null default 'equals',
  add constraint alert_rule_conditions_operator_valid check (
    match_operator in ('equals', 'in')
  );

create table momi_alerting.order_alert_route_conditions (
  source_key text not null,
  alert_kind text not null,
  destination_key text not null,
  condition_index integer not null,
  document_path text[] not null,
  match_operator text not null default 'equals',
  expected_value jsonb not null,
  created_at timestamptz not null default now(),
  primary key (
    source_key, alert_kind, destination_key, condition_index
  ),
  foreign key (source_key, alert_kind, destination_key)
    references momi_alerting.alert_routes(
      source_key, alert_kind, destination_key
    ) on delete cascade,
  constraint order_alert_route_conditions_index_positive
    check (condition_index > 0),
  constraint order_alert_route_conditions_path_present
    check (array_length(document_path, 1) > 0),
  constraint order_alert_route_conditions_operator_valid
    check (match_operator in ('equals', 'in'))
);

create table momi_alerting.preorder_policies (
  policy_key text primary key,
  location_id uuid references momi_warehouse.entities(entity_id),
  time_zone text not null,
  submission_cutoff_local time not null,
  minimum_advance_days integer not null default 1,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint preorder_policies_key_present
    check (nullif(policy_key, '') is not null),
  constraint preorder_policies_time_zone_present
    check (nullif(time_zone, '') is not null),
  constraint preorder_policies_advance_positive
    check (minimum_advance_days > 0)
);

create unique index preorder_policies_active_location_uidx
  on momi_alerting.preorder_policies (location_id) nulls not distinct
  where is_enabled;

alter table momi_alerting.order_alert_candidates
  drop constraint order_alert_candidates_presentation_v1,
  add column canonical_order_id uuid
    references momi_warehouse.entities(entity_id),
  add column trigger_event_id uuid references momi_events.events(event_id),
  add column trigger_order_version_id uuid
    references momi_warehouse.entity_versions(entity_version_id),
  add column decision_order_version_id uuid
    references momi_warehouse.entity_versions(entity_version_id),
  add column decision_contract_key text,
  add constraint order_alert_candidates_presentation_supported check (
    order_presentation ->> 'presentation_version' in ('1', '2')
  ),
  add constraint order_alert_candidates_exact_binding_valid check (
    canonical_order_id is null
    or (
      trigger_event_id is not null
      and trigger_order_version_id is not null
      and decision_order_version_id = trigger_order_version_id
      and decision_contract_key = 'momi.orders.get_by_version.v1'
      and order_presentation ->> 'presentation_version' = '2'
    )
  );

create unique index order_alert_candidates_canonical_destination_uidx
  on momi_alerting.order_alert_candidates (
    canonical_order_id, alert_kind, destination_key
  )
  where canonical_order_id is not null;

alter table momi_alerting.order_alert_route_conditions enable row level security;
alter table momi_alerting.preorder_policies enable row level security;
revoke all on table momi_alerting.order_alert_route_conditions
  from public, anon, authenticated;
revoke all on table momi_alerting.preorder_policies
  from public, anon, authenticated;

create or replace function momi_alerting.stage_order_event_work(
  p_event_id uuid,
  p_message_id bigint,
  p_capability_token uuid
)
returns table (
  disposition text,
  event_name text,
  work_id text,
  trigger_token text,
  work_status text
)
language sql
security invoker
set search_path = ''
as $$
  with target as (
    select event.event_id, event.event_name, event.entity_type,
      event.entity_id, event.schema_version, event.source_system,
      event.source_id, event.source_reference
    from momi_events.events as event
    join momi_events.deliveries as delivery
      on delivery.event_id = event.event_id
    where delivery.subscription_key = 'order-alerting-v1'
      and delivery.event_id = p_event_id
      and delivery.queue_message_id = p_message_id
      and delivery.capability_token = p_capability_token
      and delivery.status = 'running'
      and delivery.lease_expires_at > now()
  ), live as (
    select target.*, version.entity_version_id
    from target
    join momi_warehouse.entity_versions as version
      on target.source_reference ->> 'schema' = 'momi_warehouse'
      and target.source_reference ->> 'table' = 'entity_versions'
      and target.source_reference ->> 'id'
        = version.entity_version_id::text
      and version.entity_id = target.entity_id
      and version.schema_version = 2
    where target.event_name = 'warehouse.order.observed'
      and target.entity_type = 'order'
      and target.schema_version = 2
      and target.entity_id is not null
      and nullif(target.source_system, '') is not null
      and nullif(target.source_id, '') is not null
  ), inserted_work as (
    insert into momi_orders.api_invocation_work (
      source_system, source_work_kind, source_work_id,
      source_resource_kind, source_version_id, location_id,
      order_id, api_contract_key
    )
    select live.source_system, 'warehouse_event', live.event_id::text,
      'order', live.entity_version_id::text, null,
      live.entity_id::text, 'momi.orders.get_by_version.v1'
    from live
    on conflict (
      source_system, source_resource_kind,
      source_version_id, api_contract_key
    ) do nothing
    returning id, trigger_token, status
  ), resolved_work as (
    select id, trigger_token, status from inserted_work
    union all
    select work.id, work.trigger_token, work.status
    from live
    join momi_orders.api_invocation_work as work
      on work.source_system = live.source_system
      and work.source_resource_kind = 'order'
      and work.source_version_id = live.entity_version_id::text
      and work.api_contract_key = 'momi.orders.get_by_version.v1'
    where not exists (select 1 from inserted_work)
  ), inserted_bridge as (
    insert into momi_alerting.order_event_bridges (
      event_id, api_work_id, event_name, source_system,
      source_order_id, warehouse_version_id
    )
    select live.event_id, work.id, live.event_name, live.source_system,
      live.source_id, live.entity_version_id
    from live cross join resolved_work as work
    on conflict do nothing
    returning event_id, api_work_id
  ), resolved_bridge as (
    select event_id, api_work_id from inserted_bridge
    union all
    select bridge.event_id, bridge.api_work_id
    from live
    join momi_alerting.order_event_bridges as bridge
      on bridge.event_id = live.event_id
    where not exists (select 1 from inserted_bridge)
  )
  select 'ignored_non_live_v2_event', target.event_name,
    null::text, null::text, null::text
  from target
  where not exists (select 1 from live)
  union all
  select 'ready', live.event_name, work.id::text,
    work.trigger_token::text, work.status
  from live cross join resolved_work as work
  join resolved_bridge as bridge
    on bridge.api_work_id = work.id
    and bridge.event_id = live.event_id;
$$;

comment on function momi_alerting.stage_order_event_work(
  uuid, bigint, uuid
) is 'Stages exact canonical order-version alert work for one live v2 event.';

revoke all on function momi_alerting.stage_order_event_work(
  uuid, bigint, uuid
) from public, anon, authenticated;

create function momi_alerting.matches_canonical_condition(
  p_document jsonb,
  p_path text[],
  p_expected jsonb,
  p_operator text
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case p_operator
    when 'equals' then
      p_document #> p_path is not null
      and p_document #> p_path = p_expected
    when 'in' then
      jsonb_typeof(p_expected) = 'array'
      and exists (
        select 1 from jsonb_array_elements(p_expected) as allowed(value)
        where allowed.value = p_document #> p_path
      )
    else false
  end;
$$;

insert into momi_alerting.order_source_mappings (
  source_key, display_name, payload_path, expected_value, is_enabled,
  order_id_path, match_operator, source_system, api_contract_key,
  currency_code, canonical_payload_path, canonical_expected_value,
  mapping_scope
) values (
  'dm_order', 'Dough Monster Order', null, null, false,
  null, 'equals', null, null, 'USD',
  array['id']::text[], to_jsonb('canonical'::text), 'canonical'
);

insert into momi_alerting.preorder_policies (
  policy_key, location_id, time_zone, submission_cutoff_local,
  minimum_advance_days, is_enabled
) values (
  'dm_default', null, 'America/New_York', time '17:00', 1, false
);

insert into momi_alerting.alert_rules (
  source_key, alert_kind, rule_version, description, is_enabled
) values
  ('dm_order', 'new_order', 2,
    'Approved non-voided Dough Monster order', false),
  ('dm_order', 'preorder', 2,
    'Advance order submitted by the configured prior-day cutoff', false);

insert into momi_alerting.alert_rule_conditions (
  rule_id, condition_index, payload_path, expected_value,
  canonical_payload_path, canonical_expected_value, match_operator
)
select rule.id, condition.condition_index,
  condition.document_path, condition.expected_value,
  condition.document_path, condition.expected_value,
  condition.match_operator
from momi_alerting.alert_rules as rule
cross join lateral (
  select * from (values
    ('new_order', 1, array['approval_status']::text[],
      to_jsonb('approved'::text), 'equals'),
    ('new_order', 2, array['voided']::text[], 'false'::jsonb, 'equals'),
    ('preorder', 1, array['approval_status']::text[],
      '["future","approved"]'::jsonb, 'in'),
    ('preorder', 2, array['voided']::text[], 'false'::jsonb, 'equals'),
    ('preorder', 3, array['classifications','doughnut_preorder']::text[],
      'true'::jsonb, 'equals')
  ) configured(alert_kind, condition_index, document_path,
    expected_value, match_operator)
  where configured.alert_kind = rule.alert_kind
) as condition
where rule.source_key = 'dm_order' and rule.rule_version = 2;

insert into momi_alerting.slack_destinations (
  destination_key, slack_channel_id, display_name, is_enabled
)
select replace(destination_key, 'all_orders', 'preorders'),
  'C0A5VPD6TJT', 'Dough Monster Preorders', false
from momi_alerting.slack_destinations
where destination_key in ('momi_dev_all_orders', 'momi_prod_all_orders')
on conflict (destination_key) do update
set slack_channel_id = excluded.slack_channel_id,
    display_name = excluded.display_name,
    is_enabled = false;

insert into momi_alerting.alert_routes (
  source_key, alert_kind, destination_key, is_enabled
)
select distinct 'dm_order', 'new_order', route.destination_key, true
from momi_alerting.alert_routes as route
where route.source_key in ('toast_in_store', 'toast_out_of_store')
  and route.alert_kind = 'new_order' and route.is_enabled
on conflict (source_key, alert_kind, destination_key) do update
set is_enabled = excluded.is_enabled;

insert into momi_alerting.alert_routes (
  source_key, alert_kind, destination_key, is_enabled
)
select 'dm_order', 'preorder', destination_key, true
from momi_alerting.slack_destinations
where destination_key in ('momi_dev_preorders', 'momi_prod_preorders')
on conflict (source_key, alert_kind, destination_key) do update
set is_enabled = excluded.is_enabled;

comment on function momi_alerting.matches_canonical_condition(
  jsonb, text[], jsonb, text
) is 'Evaluates source-neutral alert policy and route conditions.';
revoke all on function momi_alerting.matches_canonical_condition(
  jsonb, text[], jsonb, text
) from public, anon, authenticated;

create or replace function momi_alerting.issue_order_read_capability(
  p_api_work_id bigint,
  p_attempt_id bigint,
  p_invocation_id uuid,
  p_event_id uuid,
  p_message_id bigint,
  p_delivery_capability_token uuid
)
returns table (read_work_id text, capability_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  subject_id uuid;
  subject_version_id uuid;
  selected_function_key text;
  capability_expiry timestamptz;
  issued_id bigint;
  issued_token uuid;
begin
  select work.order_id::uuid,
    case when work.api_contract_key = 'momi.orders.get_by_version.v1'
      then bridge.warehouse_version_id else null end,
    work.api_contract_key,
    least(work.lease_expires_at, delivery.lease_expires_at,
      now() + interval '30 seconds')
  into subject_id, subject_version_id, selected_function_key,
    capability_expiry
  from momi_orders.api_invocation_work as work
  join momi_orders.api_invocation_attempts as attempt
    on attempt.work_id = work.id
  join momi_alerting.order_event_bridges as bridge
    on bridge.api_work_id = work.id
    and bridge.event_name = 'warehouse.order.observed'
  join momi_events.deliveries as delivery
    on delivery.event_id = bridge.event_id
    and delivery.subscription_key = 'order-alerting-v1'
  join momi_warehouse.entities as entity
    on entity.entity_id = work.order_id::uuid
    and entity.entity_type = 'order'
  where work.id = p_api_work_id
    and work.api_contract_key in (
      'momi.orders.get_by_id.v1',
      'momi.orders.get_by_version.v1'
    )
    and (
      work.api_contract_key <> 'momi.orders.get_by_version.v1'
      or (
        work.source_version_id = bridge.warehouse_version_id::text
        and exists (
          select 1 from momi_warehouse.entity_versions as version
          where version.entity_version_id = bridge.warehouse_version_id
            and version.entity_id = entity.entity_id
        )
      )
    )
    and work.status = 'running'
    and work.lease_expires_at > now() + interval '5 seconds'
    and attempt.id = p_attempt_id
    and attempt.invocation_id = p_invocation_id
    and attempt.outcome = 'running'
    and attempt.finished_at is null
    and delivery.event_id = p_event_id
    and delivery.queue_message_id = p_message_id
    and delivery.capability_token = p_delivery_capability_token
    and delivery.status = 'running'
    and delivery.lease_expires_at > now() + interval '5 seconds'
    and not exists (
      select 1 from momi_alerting.order_read_capability_uses as used
      where used.attempt_id = attempt.id
    )
  for update of work;

  if not found then
    raise exception using errcode = '42501',
      message = 'Canonical read capability is unavailable';
  end if;

  insert into momi_api.read_capabilities as issued (
    function_key, subject_entity_id, subject_version_id,
    binding_key, expires_at
  ) values (
    selected_function_key, subject_id, subject_version_id,
    'momi.order_alert_delivery.v1', capability_expiry
  ) returning issued.id, issued.capability_token
    into issued_id, issued_token;

  insert into momi_alerting.order_read_capability_uses (
    attempt_id, api_work_id, read_capability_id, event_id, queue_message_id
  ) values (
    p_attempt_id, p_api_work_id, issued_id, p_event_id, p_message_id
  );
  return query select issued_id::text, issued_token;
end;
$$;

comment on function momi_alerting.issue_order_read_capability(
  bigint, bigint, uuid, uuid, bigint, uuid
) is 'Issues one event-bound capability for latest or exact canonical order reads.';

revoke all on function momi_alerting.issue_order_read_capability(
  bigint, bigint, uuid, uuid, bigint, uuid
) from public, anon, authenticated;

create function momi_alerting.try_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return nullif(btrim(p_value), '')::timestamptz;
exception when others then
  return null;
end;
$$;

create function momi_alerting.is_doughnut_preorder(p_order jsonb)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with selected_policy as (
    select policy.*
    from momi_alerting.preorder_policies as policy
    join pg_catalog.pg_timezone_names as zone
      on zone.name = policy.time_zone
    where policy.is_enabled
      and (
        policy.location_id is null
        or policy.location_id::text = p_order ->> 'location_id'
      )
    order by policy.location_id is not null desc, policy.policy_key
    limit 1
  ), timing as (
    select policy.*,
      momi_alerting.try_timestamptz(
        p_order ->> 'submitted_at') as submitted_at,
      momi_alerting.try_timestamptz(
        p_order #>> '{fulfillment,at}') as fulfillment_at
    from selected_policy as policy
  )
  select coalesce((
    select
      p_order #>> '{fulfillment,timing}' = 'scheduled'
      and submitted_at is not null
      and fulfillment_at is not null
      and (submitted_at at time zone time_zone)::date
        < (fulfillment_at at time zone time_zone)::date
      and submitted_at <= (
        (
          (fulfillment_at at time zone time_zone)::date
          - minimum_advance_days
        ) + submission_cutoff_local
      ) at time zone time_zone
    from timing
  ), false);
$$;

comment on function momi_alerting.is_doughnut_preorder(jsonb) is
  'Classifies an advance order using canonical timestamps and configured local cutoff.';

revoke all on function momi_alerting.try_timestamptz(text)
  from public, anon, authenticated;
revoke all on function momi_alerting.is_doughnut_preorder(jsonb)
  from public, anon, authenticated;

create or replace function momi_orders.wake_order_alert_worker()
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
  if new.api_contract_key <> 'momi.toast_orders.get_by_id.v1' then
    return new;
  end if;

  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.orders.alert_worker.http.v1'
    and registry.function_key = 'momi.orders.alert.evaluate.v1'
    and registry.route_path = '/functions/v1/momi-order-alert-worker-v1'
    and upper(registry.http_method) = 'POST'
    and registry.active;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets where name = 'momi_publishable_key';

  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'work_id', new.id::text,
      'trigger_token', new.trigger_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

comment on function momi_orders.wake_order_alert_worker() is
  'Wakes only the temporary legacy Toast alert path; events wake canonical work.';

revoke all on function momi_orders.wake_order_alert_worker()
  from public, anon, authenticated;

insert into momi_alerting.order_alert_route_conditions (
  source_key, alert_kind, destination_key, condition_index,
  document_path, match_operator, expected_value
)
select 'dm_order', 'new_order', destination_key, 1,
  array['channel_kind']::text[], 'equals',
  to_jsonb(case when destination_key like '%\_in\_store\_orders'
    then 'in_store' else 'out_of_store' end)
from momi_alerting.slack_destinations
where destination_key like '%\_in\_store\_orders'
   or destination_key like '%\_out\_of\_store\_orders'
on conflict (source_key, alert_kind, destination_key, condition_index)
do update set document_path = excluded.document_path,
  match_operator = excluded.match_operator,
  expected_value = excluded.expected_value;

create function momi_alerting.match_canonical_order_alert_routes(
  p_decision_document jsonb
)
returns table (
  source_key text, alert_kind text, destination_key text,
  rule_id bigint, rule_version integer, currency_code text,
  match_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with rule_matches as (
    select mapping.source_key, mapping.currency_code,
      rule.alert_kind, rule.id as rule_id, rule.rule_version,
      count(*) over (partition by rule.alert_kind) as match_count
    from momi_alerting.order_source_mappings as mapping
    join momi_alerting.alert_rules as rule
      on rule.source_key = mapping.source_key and rule.is_enabled
    where mapping.source_key = 'dm_order'
      and mapping.mapping_scope = 'canonical' and mapping.is_enabled
      and exists (
        select 1 from momi_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
      )
      and not exists (
        select 1 from momi_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
          and not momi_alerting.matches_canonical_condition(
            p_decision_document, condition.canonical_payload_path,
            condition.canonical_expected_value, condition.match_operator
          )
      )
  )
  select matched.source_key, matched.alert_kind, route.destination_key,
    matched.rule_id, matched.rule_version, matched.currency_code,
    matched.match_count
  from rule_matches as matched
  join momi_alerting.alert_routes as route
    on route.source_key = matched.source_key
    and route.alert_kind = matched.alert_kind and route.is_enabled
  join momi_alerting.slack_destinations as destination
    on destination.destination_key = route.destination_key
    and destination.is_enabled
  where not exists (
    select 1
    from momi_alerting.order_alert_route_conditions as condition
    where condition.source_key = route.source_key
      and condition.alert_kind = route.alert_kind
      and condition.destination_key = route.destination_key
      and not momi_alerting.matches_canonical_condition(
        p_decision_document, condition.document_path,
        condition.expected_value, condition.match_operator
      )
  );
$$;

comment on function momi_alerting.match_canonical_order_alert_routes(jsonb) is
  'Matches source-neutral order policies and independently conditioned routes.';
revoke all on function
  momi_alerting.match_canonical_order_alert_routes(jsonb)
  from public, anon, authenticated;

create function momi_alerting.claim_order_alert_candidates(
  input_api_work_id bigint,
  input_order_version_id uuid,
  input_order jsonb,
  input_order_presentation jsonb,
  input_provenance jsonb
)
returns table (
  work_found boolean, order_matches boolean,
  matched_count integer, ambiguous_count integer, claimed_count integer,
  candidate_ids jsonb
)
language sql
security invoker
set search_path = ''
as $$
  with target as (
    select work.id as api_work_id, work.order_id::uuid as order_entity_id,
      bridge.event_id, bridge.source_order_id, bridge.warehouse_version_id,
      version.source_system,
      input_order || jsonb_build_object(
        'event_name', bridge.event_name,
        'classifications', jsonb_build_object(
          'doughnut_preorder',
          momi_alerting.is_doughnut_preorder(input_order)
        )
      ) as decision_document
    from momi_orders.api_invocation_work as work
    join momi_alerting.order_event_bridges as bridge
      on bridge.api_work_id = work.id
    join momi_warehouse.entity_versions as version
      on version.entity_version_id = input_order_version_id
      and version.entity_version_id = bridge.warehouse_version_id
      and version.entity_id = work.order_id::uuid
      and version.schema_version = 2
      and version.canonical_document = input_order
      and version.provenance = input_provenance
      and version.source_system = work.source_system
      and version.source_system = bridge.source_system
    where work.id = input_api_work_id
      and work.api_contract_key = 'momi.orders.get_by_version.v1'
      and work.source_version_id = input_order_version_id::text
      and input_order ->> 'id' = work.order_id
      and input_order -> 'presentation' = input_order_presentation
      and input_order_presentation ->> 'presentation_version' = '2'
      and jsonb_typeof(input_order_presentation -> 'items') = 'array'
      and input_order #>> '{fulfillment,timing}'
        = input_order_presentation ->> 'fulfillment_timing'
      and input_order #>> '{fulfillment,timing}'
        in ('scheduled', 'asap', 'unknown')
      and jsonb_typeof(input_order -> 'voided') = 'boolean'
  ), matched as (
    select target.*, route.*
    from target
    cross join lateral
      momi_alerting.match_canonical_order_alert_routes(
        target.decision_document
      ) as route
  ), claimed as (
    insert into momi_alerting.order_alert_candidates (
      source_system, api_contract_key, order_id, canonical_order_id,
      trigger_event_id, trigger_order_version_id, decision_order_version_id,
      decision_contract_key, source_key, alert_kind, destination_key,
      api_work_id, rule_id, rule_version, decision_context, order_presentation
    )
    select source_system, 'momi.orders.get_by_version.v1',
      order_entity_id::text, order_entity_id, event_id,
      warehouse_version_id, input_order_version_id,
      'momi.orders.get_by_version.v1', source_key, alert_kind,
      destination_key, api_work_id, rule_id, rule_version,
      jsonb_build_object(
        'warehouse_event_id', event_id,
        'trigger_order_version_id', warehouse_version_id,
        'decision_order_version_id', input_order_version_id,
        'source_order_id', source_order_id,
        'source_provenance', input_provenance
      ),
      input_order_presentation || jsonb_strip_nulls(jsonb_build_object(
        'source_label', case input_order ->> 'channel_kind'
          when 'in_store' then 'In Store'
          when 'out_of_store' then 'Out of Store'
          else 'Order' end,
        'currency_code', currency_code
      ))
    from matched
    where match_count = 1
    on conflict (canonical_order_id, alert_kind, destination_key)
      where canonical_order_id is not null do nothing
    returning id
  )
  select exists (select 1 from target),
    exists (select 1 from matched where match_count = 1),
    (select count(distinct alert_kind)::integer from matched),
    (select count(distinct alert_kind)::integer
      from matched where match_count > 1),
    (select count(*)::integer from claimed),
    coalesce((select jsonb_agg(id::text order by id) from claimed), '[]'::jsonb);
$$;

comment on function momi_alerting.claim_order_alert_candidates(
  bigint, uuid, jsonb, jsonb, jsonb
) is 'Claims source-neutral alerts from one exact canonical order version.';
revoke all on function momi_alerting.claim_order_alert_candidates(
  bigint, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
