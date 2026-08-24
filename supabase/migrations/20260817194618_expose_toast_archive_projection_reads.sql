-- service-owner: communications-archive

create function toast_raw.read_order_webhook_projection_input_v1(
  p_event_guid text
)
returns table (
  source_occurred_at timestamptz,
  received_at timestamptz,
  observed_freshness_window interval
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.source_occurred_at,
    event.received_at,
    subscription.observed_freshness_window
  from toast_raw.webhook_events as event
  join toast_raw.webhook_subscriptions as subscription
    using (subscription_key)
  where event.event_guid = p_event_guid
    and event.subscription_key = 'orders';
$$;

create function toast_raw.read_resource_projection_input_v1(
  p_observation_id bigint
)
returns table (
  observation_id bigint,
  resource_version_id uuid,
  observed_at timestamptz,
  job_id bigint,
  first_operation_key text,
  source_system text,
  resource_type text,
  restaurant_guid text,
  source_id text,
  source_version_id text,
  content_hash text,
  payload jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    observation.observation_id,
    source.resource_version_id,
    observation.observed_at,
    observation_attempt.job_id,
    first_attempt.operation_key,
    source.source_system,
    source.resource_type,
    source.restaurant_guid,
    source.source_id,
    source.source_version_id,
    source.content_hash,
    source.payload
  from toast_raw.resource_observations as observation
  join toast_raw.resource_versions as source using (resource_version_id)
  join toast_raw.api_request_attempts as observation_attempt
    on observation_attempt.attempt_id = observation.attempt_id
  join toast_raw.api_request_attempts as first_attempt
    on first_attempt.attempt_id = source.first_attempt_id
  where observation.observation_id = p_observation_id;
$$;

comment on function toast_raw.read_order_webhook_projection_input_v1(text) is
  'Narrow v1 warehouse projection read for one Toast order webhook freshness decision.';
comment on function toast_raw.read_resource_projection_input_v1(bigint) is
  'Narrow v1 warehouse projection read for one archived Toast resource observation.';

revoke all on function toast_raw.read_order_webhook_projection_input_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function toast_raw.read_resource_projection_input_v1(bigint)
  from public, anon, authenticated, service_role;
grant execute on function toast_raw.read_order_webhook_projection_input_v1(text)
  to svc_warehouse_projection;
grant execute on function toast_raw.read_resource_projection_input_v1(bigint)
  to svc_warehouse_projection;
