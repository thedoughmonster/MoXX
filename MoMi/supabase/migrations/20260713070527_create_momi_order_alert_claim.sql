create function momi_alerting.claim_order_alert_candidates(
  input_api_work_id bigint,
  input_order jsonb
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
      work.source_system,
      work.source_work_kind,
      work.source_work_id,
      work.source_resource_kind,
      work.source_version_id,
      work.order_id,
      work.api_contract_key
    from momi_orders.api_invocation_work as work
    where work.id = input_api_work_id
  ), matches as (
    select target.*,
      source.source_key,
      rule.alert_kind,
      route.destination_key,
      rule.id as rule_id,
      rule.rule_version
    from target_work as target
    join momi_alerting.order_source_mappings as source
      on source.source_system = target.source_system
      and source.api_contract_key = target.api_contract_key
      and source.is_enabled
    join momi_alerting.alert_rules as rule
      on rule.source_key = source.source_key
      and rule.is_enabled
    join momi_alerting.alert_routes as route
      on route.source_key = source.source_key
      and route.alert_kind = rule.alert_kind
      and route.is_enabled
    join momi_alerting.slack_destinations as destination
      on destination.destination_key = route.destination_key
      and destination.is_enabled
    where jsonb_typeof(input_order) = 'object'
      and momi_alerting.matches_source_value(
        input_order,
        source.payload_path,
        source.expected_value,
        source.match_operator
      )
      and input_order #>> source.order_id_path = target.order_id
      and exists (
        select 1
        from momi_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
      )
      and not exists (
        select 1
        from momi_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
          and input_order #> condition.payload_path
            is distinct from condition.expected_value
      )
  ), ranked as (
    select matches.*,
      count(*) over (partition by source_system, order_id, alert_kind)
        as match_count
    from matches
  ), claimed as (
    insert into momi_alerting.order_alert_candidates (
      source_system,
      api_contract_key,
      order_id,
      source_key,
      alert_kind,
      destination_key,
      api_work_id,
      rule_id,
      rule_version,
      decision_context
    )
    select source_system,
      api_contract_key,
      order_id,
      source_key,
      alert_kind,
      destination_key,
      api_work_id,
      rule_id,
      rule_version,
      jsonb_build_object(
        'source_work_kind', source_work_kind,
        'source_work_id', source_work_id,
        'source_resource_kind', source_resource_kind,
        'source_version_id', source_version_id
      )
    from ranked
    where match_count = 1
    on conflict (source_system, order_id, alert_kind) do nothing
    returning id
  )
  select
    exists (select 1 from target_work),
    exists (select 1 from matches),
    (select count(*)::integer from ranked),
    (select count(*)::integer from ranked where match_count > 1),
    (select count(*)::integer from claimed),
    coalesce(
      (select jsonb_agg(id::text order by id) from claimed),
      '[]'::jsonb
    );
$$;
comment on function momi_alerting.claim_order_alert_candidates(bigint, jsonb)
  is 'Claims configured alerts from one approved MoMi order API response.';
revoke all on function
  momi_alerting.claim_order_alert_candidates(bigint, jsonb)
  from public, anon, authenticated;
