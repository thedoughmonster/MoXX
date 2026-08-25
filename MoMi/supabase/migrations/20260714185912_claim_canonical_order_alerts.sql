-- service-owner: order-alerting
create or replace function momi_alerting.claim_order_alert_candidates(
  input_api_work_id bigint,
  input_order jsonb,
  input_order_presentation jsonb
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
  with target_work as (
    select work.id as api_work_id,
      coalesce(bridge.source_system, work.source_system) as source_system,
      coalesce(bridge.source_order_id, work.order_id) as order_id,
      work.order_id as reader_order_id, work.source_work_kind,
      work.source_work_id, work.source_resource_kind,
      work.source_version_id, work.api_contract_key,
      bridge.event_id, bridge.event_name,
      bridge.event_id is not null as canonical,
      case when bridge.event_id is null then input_order else
        input_order || jsonb_build_object('event_name', bridge.event_name)
      end as decision_document
    from momi_orders.api_invocation_work as work
    left join momi_alerting.order_event_bridges as bridge
      on bridge.api_work_id = work.id
    where work.id = input_api_work_id
  ), rule_matches as (
    select target.*, source.source_key,
      coalesce(nullif(source.display_name, ''), source.source_key)
        as source_label,
      source.currency_code, rule.alert_kind,
      rule.id as rule_id, rule.rule_version
    from target_work as target
    join momi_alerting.order_source_mappings as source
      on source.source_system = target.source_system
      and (target.canonical
        or source.api_contract_key = target.api_contract_key)
      and source.is_enabled
    join momi_alerting.alert_rules as rule
      on rule.source_key = source.source_key and rule.is_enabled
    where jsonb_typeof(input_order) = 'object'
      and jsonb_typeof(input_order_presentation) = 'object'
      and input_order_presentation ->> 'presentation_version' = '1'
      and jsonb_typeof(input_order_presentation -> 'items') = 'array'
      and momi_alerting.matches_source_value(
        target.decision_document,
        case when target.canonical then source.canonical_payload_path
          else source.payload_path end,
        case when target.canonical then source.canonical_expected_value
          else source.expected_value end,
        source.match_operator
      )
      and case when target.canonical
        then input_order ->> 'id' = target.reader_order_id
        else input_order #>> source.order_id_path = target.order_id end
      and exists (select 1 from momi_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id)
      and not exists (select 1 from momi_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
          and target.decision_document #> case when target.canonical
            then condition.canonical_payload_path
            else condition.payload_path end
          is distinct from case when target.canonical
            then condition.canonical_expected_value
            else condition.expected_value end)
  ), ranked_rules as (
    select rule_matches.*,
      count(*) over (partition by source_system, order_id, alert_kind)
        as match_count
    from rule_matches
  ), deliveries as (
    select ranked_rules.*, route.destination_key
    from ranked_rules
    join momi_alerting.alert_routes as route
      on route.source_key = ranked_rules.source_key
      and route.alert_kind = ranked_rules.alert_kind and route.is_enabled
    join momi_alerting.slack_destinations as destination
      on destination.destination_key = route.destination_key
      and destination.is_enabled
    where ranked_rules.match_count = 1
  ), claimed as (
    insert into momi_alerting.order_alert_candidates (
      source_system, api_contract_key, order_id, source_key,
      alert_kind, destination_key, api_work_id, rule_id, rule_version,
      decision_context, order_presentation
    )
    select source_system, api_contract_key, order_id, source_key,
      alert_kind, destination_key, api_work_id, rule_id, rule_version,
      jsonb_strip_nulls(jsonb_build_object(
        'source_work_kind', source_work_kind,
        'source_work_id', source_work_id,
        'source_resource_kind', source_resource_kind,
        'source_version_id', source_version_id,
        'warehouse_event_id', event_id,
        'reader_order_id', case when canonical then reader_order_id end
      )),
      input_order_presentation || jsonb_strip_nulls(jsonb_build_object(
        'source_label', source_label, 'currency_code', currency_code
      ))
    from deliveries
    on conflict (source_system, order_id, alert_kind, destination_key)
      do nothing
    returning id
  )
  select exists (select 1 from target_work),
    exists (select 1 from deliveries),
    (select count(*)::integer from ranked_rules),
    (select count(*)::integer from ranked_rules where match_count > 1),
    (select count(*)::integer from claimed),
    coalesce((select jsonb_agg(id::text order by id) from claimed),
      '[]'::jsonb);
$$;
comment on function
  momi_alerting.claim_order_alert_candidates(bigint, jsonb, jsonb) is
  'Claims legacy or canonical alerts with one source order identity.';
