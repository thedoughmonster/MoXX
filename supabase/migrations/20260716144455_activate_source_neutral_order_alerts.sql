-- service-owner: order-alerting

create function momi_alerting.prevent_cross_path_order_alert_duplicate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_order_id text := coalesce(
    nullif(new.decision_context ->> 'source_order_id', ''),
    new.order_id
  );
  identity_key text := pg_catalog.concat_ws(
    ':', new.source_system, source_order_id,
    new.alert_kind, new.destination_key
  );
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(identity_key, 0)
  );

  if exists (
    select 1
    from momi_alerting.order_alert_candidates as candidate
    where candidate.source_system = new.source_system
      and coalesce(
        nullif(candidate.decision_context ->> 'source_order_id', ''),
        candidate.order_id
      ) = source_order_id
      and candidate.alert_kind = new.alert_kind
      and candidate.destination_key = new.destination_key
  ) then
    return null;
  end if;

  return new;
end;
$$;

create trigger prevent_cross_path_order_alert_duplicate
before insert on momi_alerting.order_alert_candidates
for each row execute function
  momi_alerting.prevent_cross_path_order_alert_duplicate();

comment on function
  momi_alerting.prevent_cross_path_order_alert_duplicate() is
  'Deduplicates transitional and canonical candidates by source order identity.';

revoke all on function
  momi_alerting.prevent_cross_path_order_alert_duplicate()
  from public, anon, authenticated;

set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table toast_raw.order_webhook_events in share row exclusive mode;
lock table momi_events.events in share row exclusive mode;

do $$
declare
  activation_floor timestamptz := clock_timestamp() - interval '1 minute';
  preorder_destination text;
  enabled_environment_count integer;
begin
  select count(*), min(replace(destination_key, 'all_orders', 'preorders'))
  into enabled_environment_count, preorder_destination
  from momi_alerting.slack_destinations
  where destination_key in ('momi_dev_all_orders', 'momi_prod_all_orders')
    and is_enabled;

  if enabled_environment_count <> 1 then
    raise exception 'Exactly one alert environment must be enabled';
  end if;

  if not exists (
    select 1 from momi_alerting.order_event_cutover_readiness_v1
    where worker_ready and reader_ready and mappings_ready
      and duplicate_safe and safe_ack_ready
  ) then
    raise exception 'Order alert cutover readiness failed';
  end if;

  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'momi.orders.get_by_version.v1'
      and owner_service = 'warehouse-read-api' and function_type = 'read'
      and manifest_sha256 =
        '46c4433394c2eb44e9c3df03f0cd349f002f879d90bb8a1c00f7add275168f8d'
      and active
  ) or not exists (
    select 1 from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.orders.get_by_version.http.v1'
      and function_key = 'momi.orders.get_by_version.v1'
      and route_path = '/functions/v1/momi-orders-get-by-version-v1'
      and upper(http_method) = 'POST'
      and authentication_policy_key = 'durable.read_capability.v1'
      and active
  ) or not exists (
    select 1 from momi_api.read_view_registry
    where view_key = 'momi.orders.get_by_version.v1'
      and view_or_function_name = 'order_versions_by_id_v1'
      and active
  ) then
    raise exception 'Exact canonical order reader is not ready';
  end if;

  if exists (
    select 1 from momi_orders.api_invocation_work
    where api_contract_key = 'momi.toast_orders.get_by_id.v1'
      and status in ('pending', 'running', 'retry_wait')
  ) then
    raise exception 'Legacy order alert work is not terminal';
  end if;

  if (select count(*) from toast_hydration.webhook_order_mappings
    where downstream_api_contract_key = 'momi.toast_orders.get_by_id.v1'
      and is_enabled) <> 1
  then
    raise exception 'Legacy order alert producer gate is not ready';
  end if;

  if not exists (
    select 1 from momi_alerting.slack_destinations
    where destination_key = preorder_destination
      and slack_channel_id = 'C0A5VPD6TJT'
  ) then
    raise exception 'Environment preorder destination is not ready';
  end if;

  update toast_hydration.webhook_order_mappings
  set is_enabled = false
  where is_enabled
    and downstream_api_contract_key = 'momi.toast_orders.get_by_id.v1';

  update momi_alerting.order_source_mappings
  set is_enabled = true
  where source_key = 'dm_order' and mapping_scope = 'canonical';

  update momi_alerting.alert_rules
  set is_enabled = true
  where source_key = 'dm_order' and rule_version = 2
    and alert_kind in ('new_order', 'preorder');

  update momi_alerting.preorder_policies
  set is_enabled = true
  where policy_key = 'dm_default'
    and time_zone = 'America/New_York'
    and submission_cutoff_local = time '17:00'
    and minimum_advance_days = 1;

  update momi_alerting.slack_destinations
  set is_enabled = destination_key = preorder_destination
  where destination_key in ('momi_dev_preorders', 'momi_prod_preorders');

  update momi_events.subscriptions
  set event_pattern = 'warehouse.order.observed',
      minimum_recorded_at = activation_floor,
      active = true
  where subscription_key = 'order-alerting-v1'
    and consumer_service = 'order-alerting'
    and queue_name = 'order_alerting_v1';

  perform cron.alter_job(job_id := jobid, active := true)
  from cron.job
  where jobname = 'momi-order-alert-event-wakeup-v1';

  update momi_events.routing_work as work
  set status = 'retry_wait', next_attempt_at = now(),
      lease_expires_at = null, capability_token = gen_random_uuid(),
      completed_at = null, last_error = null
  from momi_events.events as event
  where event.event_id = work.event_id
    and event.event_name = 'warehouse.order.observed'
    and event.recorded_at >= activation_floor
    and work.status = 'succeeded'
    and not exists (
      select 1 from momi_events.deliveries as delivery
      where delivery.event_id = event.event_id
        and delivery.subscription_key = 'order-alerting-v1'
    );

  if not exists (
    select 1 from momi_events.subscriptions
    where subscription_key = 'order-alerting-v1'
      and event_pattern = 'warehouse.order.observed' and active
      and minimum_recorded_at = activation_floor
  ) or (select count(*) from cron.job
    where jobname = 'momi-order-alert-event-wakeup-v1' and active) <> 1
  then
    raise exception 'Canonical order alert event delivery did not activate';
  end if;

  if (select count(*) from momi_alerting.order_source_mappings
      where source_key = 'dm_order' and is_enabled) <> 1
    or (select count(*) from momi_alerting.alert_rules
      where source_key = 'dm_order' and rule_version = 2
        and alert_kind in ('new_order', 'preorder') and is_enabled) <> 2
    or (select count(*) from momi_alerting.preorder_policies
      where policy_key = 'dm_default' and is_enabled) <> 1
    or (select count(*) from momi_alerting.slack_destinations
      where destination_key = preorder_destination and is_enabled) <> 1
    or exists (
      select 1 from toast_hydration.webhook_order_mappings
      where downstream_api_contract_key = 'momi.toast_orders.get_by_id.v1'
        and is_enabled
    )
  then
    raise exception 'Canonical order alert configuration is incomplete';
  end if;
end;
$$;
