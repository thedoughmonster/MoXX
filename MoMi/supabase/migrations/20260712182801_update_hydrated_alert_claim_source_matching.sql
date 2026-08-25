create or replace function toast_alerting.claim_hydrated_order_alert_candidates(
  input_order_api_work_id bigint,
  input_order jsonb
)
returns table (
  work_found boolean, order_matches boolean,
  matched_count integer, ambiguous_count integer,
  claimed_count integer, candidate_ids jsonb
)
language sql
security invoker
set search_path = ''
as $$
  with target_work as (
    select work.id as order_api_work_id,
      work.hydration_job_id,
      work.order_version_id,
      work.order_guid,
      work.api_contract_key,
      job.raw_event_id
    from toast_hydration.order_api_invocation_work as work
    join toast_hydration.order_hydration_jobs as job
      on job.id = work.hydration_job_id
    where work.id = input_order_api_work_id
  ), matches as (
    select target.*,
      source.source_key,
      rule.alert_kind,
      route.destination_key,
      rule.id as rule_id,
      rule.rule_version
    from target_work as target
    join toast_alerting.toast_sources as source
      on source.is_enabled
    join toast_alerting.alert_rules as rule
      on rule.source_key = source.source_key
      and rule.is_enabled
    join toast_alerting.alert_routes as route
      on route.source_key = source.source_key
      and route.alert_kind = rule.alert_kind
      and route.is_enabled
    join toast_alerting.slack_destinations as destination
      on destination.destination_key = route.destination_key
      and destination.is_enabled
    where jsonb_typeof(input_order) = 'object'
      and input_order ->> 'guid' = target.order_guid
      and toast_alerting.matches_source_value(
        input_order,
        source.payload_path,
        source.expected_value,
        source.match_operator
      )
      and input_order #>> source.order_guid_path = target.order_guid
      and exists (
        select 1
        from toast_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
      )
      and not exists (
        select 1
        from toast_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
          and input_order #> condition.payload_path
            is distinct from condition.expected_value
      )
  ), ranked as (
    select matches.*,
      count(*) over (
        partition by order_guid, alert_kind
      ) as match_count
    from matches
  ), claimed as (
    insert into toast_alerting.order_alert_candidates (
      toast_order_guid,
      source_key,
      alert_kind,
      destination_key,
      raw_event_id,
      hydration_job_id,
      order_version_id,
      order_api_work_id,
      rule_id,
      rule_version,
      decision_context
    )
    select
      order_guid,
      source_key,
      alert_kind,
      destination_key,
      raw_event_id,
      hydration_job_id,
      order_version_id,
      order_api_work_id,
      rule_id,
      rule_version,
      jsonb_build_object('api_contract_key', api_contract_key)
    from ranked
    where match_count = 1
    on conflict (toast_order_guid, alert_kind) do nothing
    returning id
  )
  select
    exists (select 1 from target_work),
    exists (
      select 1 from target_work
      where order_guid = input_order ->> 'guid'
    ),
    (select count(*)::integer from ranked),
    (select count(*)::integer from ranked where match_count > 1),
    (select count(*)::integer from claimed),
    coalesce(
      (select jsonb_agg(id::text order by id) from claimed),
      '[]'::jsonb
    );
$$;

comment on function toast_alerting.claim_hydrated_order_alert_candidates(bigint, jsonb) is 'Claims configured alerts from one MoMi Order API response.';

revoke all on function toast_alerting.claim_hydrated_order_alert_candidates(bigint, jsonb) from public, anon, authenticated;
