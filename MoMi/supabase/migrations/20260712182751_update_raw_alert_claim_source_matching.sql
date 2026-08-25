create or replace function toast_alerting.claim_order_alert_candidates(
  input_raw_event_id bigint
)
returns table (
  event_found boolean,
  matched_count integer,
  ambiguous_count integer,
  claimed_count integer,
  candidate_ids jsonb
)
language sql
security invoker
set search_path = ''
as $$
  with target_event as (
    select id, payload
    from toast_raw.order_webhook_events
    where id = input_raw_event_id
  ), matches as (
    select
      event.id as raw_event_id,
      event.payload #>> source.order_guid_path as toast_order_guid,
      source.source_key,
      rule.alert_kind,
      route.destination_key,
      rule.id as rule_id,
      rule.rule_version
    from target_event as event
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
    where toast_alerting.matches_source_value(
        event.payload,
        source.payload_path,
        source.expected_value,
        source.match_operator
      )
      and nullif(event.payload #>> source.order_guid_path, '') is not null
      and exists (
        select 1
        from toast_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
      )
      and not exists (
        select 1
        from toast_alerting.alert_rule_conditions as condition
        where condition.rule_id = rule.id
          and event.payload #> condition.payload_path
            is distinct from condition.expected_value
      )
  ), ranked as (
    select matches.*,
      count(*) over (
        partition by toast_order_guid, alert_kind
      ) as match_count
    from matches
  ), claimed as (
    insert into toast_alerting.order_alert_candidates (
      toast_order_guid,
      source_key,
      alert_kind,
      destination_key,
      raw_event_id,
      rule_id,
      rule_version
    )
    select
      toast_order_guid,
      source_key,
      alert_kind,
      destination_key,
      raw_event_id,
      rule_id,
      rule_version
    from ranked
    where match_count = 1
    on conflict (toast_order_guid, alert_kind) do nothing
    returning id
  )
  select
    exists (select 1 from target_event),
    (select count(*)::integer from ranked),
    (select count(*)::integer from ranked where match_count > 1),
    (select count(*)::integer from claimed),
    coalesce(
      (select jsonb_agg(id::text order by id) from claimed),
      '[]'::jsonb
    );
$$;

comment on function toast_alerting.claim_order_alert_candidates(bigint) is
  'Atomically claims configured Toast order alert candidates for one raw event.';

revoke all on function toast_alerting.claim_order_alert_candidates(bigint)
  from public, anon, authenticated;
