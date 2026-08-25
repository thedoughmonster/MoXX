with
provided_boundary as (
  select nullif(current_setting('momi.recovery_boundary', true), '')::jsonb as value
),
query_clock as (
  select date_trunc('milliseconds', clock_timestamp()) as observed_at
),
sample_clock as (
  select q.observed_at,
    coalesce(to_timestamp((value ->> 'cohortStartedAtUtcMs')::bigint / 1000.0),
      q.observed_at) as started_at,
    value
  from provided_boundary cross join query_clock q
),
active_registry as (
  select s.schedule_key, s.operation_key, s.source_key, s.restaurant_guid,
    s.mode, s.schedule_kind, s.timezone, s.interval_seconds, s.local_run_time,
    s.day_of_month, s.window_key, s.parameter_defaults, s.window_lookback_seconds,
    s.next_due_at, o.pagination_kind, o.requires_window,
    o.is_enabled as operation_enabled, x.is_enabled as source_enabled,
    r.is_enabled as restaurant_enabled
  from toast_acquisition.schedules s
  left join toast_acquisition.operations o using (operation_key)
  left join toast_acquisition.sources x using (source_key)
  left join toast_acquisition.restaurants r using (source_key, restaurant_guid)
  where s.active
),
registry_summary as (
  select count(*)::bigint as rows,
    count(*) filter (where operation_enabled is not true
      or source_enabled is not true or restaurant_enabled is not true)::bigint
      as contract_violations,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', schedule_key, operation_key, source_key, restaurant_guid,
        mode, schedule_kind, timezone, coalesce(interval_seconds::text, ''),
        coalesce(local_run_time::text, ''), coalesce(day_of_month::text, ''),
        coalesce(window_key, ''), parameter_defaults::text,
        coalesce(window_lookback_seconds::text, ''), pagination_kind,
        requires_window::text, operation_enabled::text,
        source_enabled::text, restaurant_enabled::text), E'\n'
      order by schedule_key), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', schedule_key, to_char(next_due_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')), E'\n' order by schedule_key), ''),
      'UTF8'), 'sha256'), 'hex') as due_fingerprint
  from active_registry
),
routing_catalog as (
  select subscription_key, consumer_service, event_pattern, queue_name,
    dead_letter_queue_name, active, minimum_recorded_at
  from momi_events.subscriptions
),
routing_catalog_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', subscription_key, consumer_service, event_pattern,
        queue_name, dead_letter_queue_name, active::text,
        to_char(minimum_recorded_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')), E'\n'
      order by subscription_key), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from routing_catalog
),
calculated_due_occurrences as (
  select coalesce(jsonb_agg(jsonb_build_object('scheduleKey', schedule_key,
    'dueAtUtcMs', floor(extract(epoch from next_due_at) * 1000)::bigint)
    order by schedule_key), '[]'::jsonb) as rows
  from active_registry cross join sample_clock
  where next_due_at <= started_at
),
frozen_due_occurrences as (
  select coalesce(sample_clock.value -> 'dueOccurrences', calculated.rows) as rows
  from sample_clock cross join calculated_due_occurrences calculated
),
due_occurrences as (
  select entry ->> 'scheduleKey' as schedule_key,
    (entry ->> 'dueAtUtcMs')::bigint as due_at_utc_ms
  from frozen_due_occurrences
  cross join lateral jsonb_array_elements(rows) entry
),
due_occurrence_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', schedule_key, due_at_utc_ms::text), E'\n'
      order by schedule_key, due_at_utc_ms), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from due_occurrences
),
boundary_values as (
  select c.started_at,
    coalesce((c.value ->> 'jobHighWater')::bigint,
      (select coalesce(max(job_id), 0) from toast_acquisition.jobs)) as job_high_water,
    coalesce((c.value ->> 'observationHighWater')::bigint,
      (select coalesce(max(observation_id), 0)
       from toast_raw.resource_observations)) as observation_high_water
  from sample_clock c
),
toast_lineage as (
  select j.*, schedule.matches as schedule_matches,
    fanout.matches as fanout_matches, fanout.parent_job_id,
    schedule.occurrence_is_future or fanout.occurrence_is_future as lineage_is_future,
    schedule.matches = 1 and schedule.legal_cursor
      and j.page_count > 0 and j.page_count < j.page_budget
      and j.cursor <> '{}'::jsonb as legal_continuation,
    (case when schedule.matches = 1 and j.page_count = 0
        and j.cursor = '{}'::jsonb then 1 else 0 end
      + case when schedule.matches = 1 and schedule.legal_cursor
        and j.page_count > 0 and j.page_count < j.page_budget
        and j.cursor <> '{}'::jsonb then 1 else 0 end
      + case when fanout.matches = 1 and j.page_count = 0
        and j.cursor = '{}'::jsonb then 1 else 0 end) as accepted_lineage_count
  from toast_acquisition.jobs j cross join sample_clock c cross join boundary_values b
  cross join lateral (
    select count(*)::bigint as matches,
      coalesce(bool_and((a.pagination_kind in ('page', 'cursor')
          or a.requires_window)
        and case when jsonb_typeof(j.cursor) = 'object' then
          exists (select 1 from jsonb_object_keys(j.cursor))
          and not exists (select 1 from jsonb_object_keys(j.cursor) key
            where key not in ('page', 'pageToken', 'window_start', 'businessDate'))
        else false end
        and not (j.cursor ? 'page' and j.cursor ? 'pageToken')
        and not (j.cursor ? 'window_start' and j.cursor ? 'businessDate')
        and (not (j.cursor ? 'page') or (a.pagination_kind = 'page'
          and jsonb_typeof(j.cursor -> 'page') = 'number'
          and j.cursor ->> 'page' ~ '^[1-9][0-9]*$'))
        and (not (j.cursor ? 'pageToken') or (a.pagination_kind = 'cursor'
          and jsonb_typeof(j.cursor -> 'pageToken') = 'string'
          and btrim(j.cursor ->> 'pageToken') = j.cursor ->> 'pageToken'
          and length(j.cursor ->> 'pageToken') between 1 and 16384))
        and (not (j.cursor ? 'businessDate') or (a.requires_window
          and jsonb_typeof(j.cursor -> 'businessDate') = 'string'
          and j.cursor ->> 'businessDate' ~ '^[0-9]{8}$'
          and pg_input_is_valid(concat(substring(j.cursor ->> 'businessDate', 1, 4),
            '-', substring(j.cursor ->> 'businessDate', 5, 2), '-',
            substring(j.cursor ->> 'businessDate', 7, 2)), 'date')))
        and (not (j.cursor ? 'window_start') or (a.requires_window
          and jsonb_typeof(j.cursor -> 'window_start') = 'string'
          and j.cursor ->> 'window_start' ~
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
          and pg_input_is_valid(j.cursor ->> 'window_start', 'timestamptz')))
      ), false) as legal_cursor,
      coalesce(bool_or(substring(j.idempotency_key from length(a.schedule_key) + 2)
        > to_char(c.observed_at at time zone 'UTC', 'YYYYMMDDHH24MISS')), false)
        as occurrence_is_future
    from active_registry a
    where j.idempotency_key like a.schedule_key || ':%'
      and length(j.idempotency_key) = length(a.schedule_key) + 15
      and substring(j.idempotency_key from length(a.schedule_key) + 2)
        ~ '^[0-9]{14}$'
      and (a.operation_key, a.source_key, a.restaurant_guid, a.mode) =
        (j.operation_key, j.source_key, j.restaurant_guid, j.mode)
      and a.operation_enabled is true and a.source_enabled is true
      and a.restaurant_enabled is true
  ) schedule
  cross join lateral (
    select count(*)::bigint as matches, min(parent.job_id) as parent_job_id,
      coalesce(bool_or(substring(parent.idempotency_key
        from length(a.schedule_key) + 2)
        > to_char(c.observed_at at time zone 'UTC', 'YYYYMMDDHH24MISS')), false)
        as occurrence_is_future
    from toast_acquisition.jobs parent
    join active_registry a on parent.idempotency_key like a.schedule_key || ':%'
      and length(parent.idempotency_key) = length(a.schedule_key) + 15
      and substring(parent.idempotency_key from length(a.schedule_key) + 2)
        ~ '^[0-9]{14}$'
      and (a.operation_key, a.source_key, a.restaurant_guid, a.mode) =
        (parent.operation_key, parent.source_key, parent.restaurant_guid, parent.mode)
      and a.operation_enabled is true and a.source_enabled is true
      and a.restaurant_enabled is true
    join toast_acquisition.operations detail
      on detail.operation_key = j.operation_key
    join toast_acquisition.operation_parameters parameter
      on parameter.operation_key = detail.operation_key
      and parameter.parameter_key = 'guid'
    where j.operation_key = 'toast.payments.get.v1' and j.mode = 'repair'
      and j.reason = 'Payment detail discovered from archived payment list'
      and j.window_start is null and j.window_end is null
      and j.idempotency_key ~ ('^toast[.]payment[.]detail:[1-9][0-9]{0,18}:'
        || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      and split_part(j.idempotency_key, ':', 2) = parent.job_id::text
      and split_part(j.idempotency_key, ':', 3) = lower(j.parameters ->> 'guid')
      and j.parameters = jsonb_build_object('guid', j.parameters ->> 'guid')
      and j.parameters ->> 'guid' ~ parameter.validation_pattern
      and parent.operation_key = 'toast.payments.list.v1'
      and (parent.source_key, parent.restaurant_guid, parent.correlation_id) =
        (j.source_key, j.restaurant_guid, j.correlation_id)
      and parent.status in ('pending', 'running', 'succeeded')
      and parent.created_at <= c.observed_at
      and detail.source_operation_id = 'paymentsGuidGet'
      and detail.response_kind = 'document' and detail.pagination_kind = 'none'
      and detail.exact_resource_only and detail.is_enabled
      and parameter.parameter_location = 'path' and parameter.data_type = 'string'
      and parameter.required and parameter.validation_pattern is not null
      and (select count(*) from toast_acquisition.operation_parameters extra
        where extra.operation_key = detail.operation_key) = 1
  ) fanout
  where j.status <> 'succeeded' or j.created_at >= b.started_at
    or (j.job_id <= b.job_high_water and j.completed_at >= b.started_at)
),
toast_classification as (
  select count(*) filter (where j.status <> 'succeeded')::bigint as open_rows,
    count(*) filter (where j.status = 'pending' and j.next_attempt_at <= c.observed_at)::bigint as ready,
    count(*) filter (where j.status = 'running')::bigint as running,
    count(*) filter (where j.status = 'retry_wait')::bigint as retry_rows,
    count(*) filter (where j.status = 'dead_letter')::bigint as dead_rows,
    count(*) filter (where j.status <> 'succeeded' and (j.next_attempt_at > c.observed_at
      or j.created_at > c.observed_at or j.lineage_is_future))::bigint as future_rows,
    count(*) filter (where j.status <> 'succeeded' and j.attempt_count <> 0)::bigint as attempted_rows,
    count(*) filter (where j.status <> 'succeeded' and j.status <> 'pending')::bigint as unexpected_rows,
    count(*) filter (where j.status <> 'succeeded' and (j.lease_expires_at is not null
      or j.completed_at is not null or j.last_error is not null
      or ((j.page_count <> 0 or j.cursor <> '{}'::jsonb)
        and not j.legal_continuation)))::bigint as partial_rows,
    count(*) filter (where j.status <> 'succeeded'
      and j.accepted_lineage_count <> 1)::bigint as unmatched_rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', j.job_id::text, j.idempotency_key, j.operation_key,
        j.source_key, j.restaurant_guid, j.mode, j.status, j.attempt_count::text),
      E'\n' order by j.job_id), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from toast_lineage j cross join sample_clock c
),
valid_projector_events as (
  select e.*
  from momi_events.events e
  where (
    (e.event_name in ('warehouse.order.observed', 'warehouse.order.reconciled')
      and e.source_system = 'toast' and e.source_resource_type = 'order'
      and e.schema_version = 2 and e.entity_type = 'order' and e.entity_id is not null
      and e.idempotency_key ~ ('^warehouse:order:[0-9a-f]{8}-[0-9a-f]{4}-'
        || '[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    or (e.event_name = 'warehouse.stock.observed'
      and e.source_system = 'toast' and e.source_resource_type = 'stock_state'
      and e.schema_version = 1 and e.entity_type = 'menu_item' and e.entity_id is not null
      and e.idempotency_key ~ ('^warehouse:stock:[0-9a-f]{8}-[0-9a-f]{4}-'
        || '[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
  )
),
projector_events as (
  select e.* from valid_projector_events e
  cross join lateral (
    select count(*)::bigint as patterns
    from routing_catalog s where e.event_name like s.event_pattern
  ) matches
  where e.event_name = 'warehouse.order.observed' or matches.patterns = 0
),
source_observation_events as (
  select e.event_id, o.observation_id, e.correlation_id
  from momi_events.events e
  join toast_raw.resource_observations o
    on e.source_reference ->> 'schema' = 'toast_raw'
    and e.source_reference ->> 'table' = 'resource_observations'
    and e.source_reference ->> 'id' ~ '^[0-9]+$'
    and (e.source_reference ->> 'id')::bigint = o.observation_id
    and e.correlation_id = o.correlation_id
  where e.source_system = 'toast' and e.event_name like 'source.toast.%'
),
source_job_events as (
  select e.event_id, j.job_id, e.correlation_id
  from momi_events.events e
  join toast_acquisition.jobs j
    on e.source_reference ->> 'schema' = 'toast_acquisition'
    and e.source_reference ->> 'table' = 'jobs'
    and e.source_reference ->> 'id' ~ '^[0-9]+$'
    and (e.source_reference ->> 'id')::bigint = j.job_id
    and e.correlation_id = j.correlation_id
  where e.source_system = 'toast' and e.event_name like 'source.toast.%'
),
source_webhook_events as (
  select e.event_id, w.id as webhook_id, e.correlation_id
  from momi_events.events e
  join toast_raw.webhook_events w
    on e.source_reference ->> 'schema' = 'toast_raw'
    and e.source_reference ->> 'table' = 'webhook_events'
    and e.source_reference ->> 'id' ~ '^[0-9]+$'
    and (e.source_reference ->> 'id')::bigint = w.id
    and e.correlation_id = w.correlation_id
  where e.source_system = 'toast' and e.event_name like 'source.toast.%'
),
projector_parent_candidates as (
  select child.event_id as child_event_id, source.event_id as parent_event_id
  from projector_events child
  join momi_warehouse.version_observations v
    on child.source_reference ->> 'schema' = 'momi_warehouse'
    and child.source_reference ->> 'table' = 'entity_versions'
    and child.source_reference ->> 'id' ~ '^[0-9a-f-]{36}$'
    and (child.source_reference ->> 'id')::uuid = v.entity_version_id
    and child.correlation_id = v.correlation_id
  join source_observation_events source
    on v.source_observation_key ~ '^toast:resource-observation:[0-9]+(:[a-z0-9-]+)?$'
    and split_part(v.source_observation_key, ':', 3)::bigint = source.observation_id
    and child.correlation_id = source.correlation_id
  where child.event_name <> 'warehouse.order.observed'
  union all
  select child.event_id, source.event_id
  from projector_events child
  join momi_warehouse.version_observations v
    on child.source_reference ->> 'schema' = 'momi_warehouse'
    and child.source_reference ->> 'table' = 'entity_versions'
    and child.source_reference ->> 'id' ~ '^[0-9a-f-]{36}$'
    and (child.source_reference ->> 'id')::uuid = v.entity_version_id
    and child.correlation_id = v.correlation_id
  join momi_events.events source
    on v.source_observation_key ~ ('^toast:event:[0-9a-f]{8}-[0-9a-f]{4}-'
      || '[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    and split_part(v.source_observation_key, ':', 3)::uuid = source.event_id
    and source.event_name like 'source.toast.%'
    and child.correlation_id = source.correlation_id
  where child.event_name <> 'warehouse.order.observed'
  union all
  select child.event_id, source.event_id
  from projector_events child
  join momi_warehouse.stock_observations stock
    on child.source_reference ->> 'schema' = 'momi_warehouse'
    and child.source_reference ->> 'table' = 'stock_observations'
    and child.source_reference ->> 'id' ~ '^[0-9a-f-]{36}$'
    and (child.source_reference ->> 'id')::uuid = stock.observation_id
    and child.correlation_id = stock.correlation_id
  join source_observation_events source
    on stock.source_reference ->> 'schema' = 'toast_raw'
    and stock.source_reference ->> 'table' = 'resource_observations'
    and stock.source_reference ->> 'id' ~ '^[0-9]+$'
    and (stock.source_reference ->> 'id')::bigint = source.observation_id
    and child.correlation_id = source.correlation_id
  union all
  select child.event_id, source.event_id
  from projector_events child
  join momi_warehouse.stock_observations stock
    on child.source_reference ->> 'schema' = 'momi_warehouse'
    and child.source_reference ->> 'table' = 'stock_observations'
    and child.source_reference ->> 'id' ~ '^[0-9a-f-]{36}$'
    and (child.source_reference ->> 'id')::uuid = stock.observation_id
    and child.correlation_id = stock.correlation_id
  join source_webhook_events source
    on stock.source_reference ->> 'schema' = 'toast_raw'
    and stock.source_reference ->> 'table' = 'webhook_events'
    and stock.source_reference ->> 'id' ~ '^[0-9]+$'
    and (stock.source_reference ->> 'id')::bigint = source.webhook_id
    and child.correlation_id = source.correlation_id
  union all
  select child.event_id, source.event_id
  from projector_events child
  join momi_warehouse.stock_observations stock
    on child.source_reference ->> 'schema' = 'momi_warehouse'
    and child.source_reference ->> 'table' = 'stock_observations'
    and child.source_reference ->> 'id' ~ '^[0-9a-f-]{36}$'
    and (child.source_reference ->> 'id')::uuid = stock.observation_id
    and child.correlation_id = stock.correlation_id
  join source_job_events source
    on stock.source_reference ->> 'job_id' ~ '^[0-9]+$'
    and (stock.source_reference ->> 'job_id')::bigint = source.job_id
    and child.correlation_id = source.correlation_id
  union all
  select child.event_id, source.event_id
  from projector_events child
  join momi_warehouse.entity_versions version
    on child.source_reference ->> 'schema' = 'momi_warehouse'
    and child.source_reference ->> 'table' = 'entity_versions'
    and child.source_reference ->> 'id' ~ '^[0-9a-f-]{36}$'
    and (child.source_reference ->> 'id')::uuid = version.entity_version_id
    and child.entity_id = version.entity_id
    and child.source_id = version.source_id
    and child.occurred_at = version.source_observed_at
  join momi_warehouse.version_observations observation
    on observation.entity_version_id = version.entity_version_id
    and observation.correlation_id = child.correlation_id
  join momi_events.events source
    on observation.source_observation_key = 'toast:event:' || source.event_id::text
    and observation.source_reference ->> 'source_observation_key'
      = observation.source_observation_key
    and source.event_name = 'source.toast.webhook.orders.observed'
    and source.source_system = 'toast'
    and source.source_resource_type = 'webhook.orders'
    and source.schema_version = 1
    and source.correlation_id = child.correlation_id
    and source.source_reference ->> 'schema' = 'toast_raw'
    and source.source_reference ->> 'table' = 'webhook_events'
    and source.source_reference ->> 'id' ~ '^[0-9]+$'
  join toast_raw.webhook_events webhook
    on webhook.id = (source.source_reference ->> 'id')::bigint
    and webhook.subscription_key = 'orders'
    and webhook.event_guid = source.source_id
    and webhook.correlation_id = source.correlation_id
    and version.source_version_id = 'webhook:' || webhook.event_guid
    and version.provenance ->> 'source_observation_key'
      = observation.source_observation_key
    and version.provenance ->> 'source_version_id' = version.source_version_id
    and observation.source_reference ->> 'source_version_id'
      = version.source_version_id
  where child.event_name = 'warehouse.order.observed'
    and version.source_system = 'toast'
    and version.source_resource_type = 'order'
),
projector_parent_summary as (
  select child_event_id, count(*)::bigint as parent_count,
    min(parent_event_id::text)::uuid as parent_event_id
  from projector_parent_candidates group by child_event_id
),
routing_open as (
  select w.*, e.source_system, e.source_resource_type, e.event_name,
    e.idempotency_key, e.schema_version, e.entity_type, e.entity_id, e.recorded_at
  from momi_events.routing_work w join momi_events.events e using (event_id)
),
routing_lineage as (
  select w.*, matches.patterns as matching_subscription_patterns,
    matches.active_eligible as active_eligible_subscriptions,
    parents.parent_count, parents.parent_event_id,
    (case when w.source_system = 'toast' and w.event_name like 'source.toast.%'
        and matches.active_eligible = 1 then 1 else 0 end
      + case when exists (select 1 from projector_events projector
          where projector.event_id = w.event_id)
        and parents.parent_count = 1
        and ((w.event_name = 'warehouse.order.observed'
            and matches.patterns = 1 and matches.active_eligible = 1)
          or (w.event_name <> 'warehouse.order.observed' and matches.patterns = 0))
        then 1 else 0 end) as accepted_lineage_count
  from routing_open w
  left join projector_parent_summary parents on parents.child_event_id = w.event_id
  cross join lateral (
    select count(*)::bigint as patterns,
      count(*) filter (where s.active
        and w.recorded_at >= s.minimum_recorded_at)::bigint as active_eligible
    from routing_catalog s where w.event_name like s.event_pattern
  ) matches
),
routing_classification as (
  select count(*) filter (where w.status <> 'succeeded')::bigint as open_rows,
    count(*) filter (where w.status = 'pending' and w.next_attempt_at <= c.observed_at)::bigint as ready,
    count(*) filter (where w.status = 'running')::bigint as running,
    count(*) filter (where w.status = 'retry_wait')::bigint as retry_rows,
    count(*) filter (where w.status = 'dead_letter')::bigint as dead_rows,
    count(*) filter (where w.status <> 'succeeded' and (w.status <> 'pending'
      or w.attempt_count <> 0 or w.next_attempt_at > c.observed_at
      or w.recorded_at > c.observed_at
      or w.lease_expires_at is not null or w.completed_at is not null
      or w.last_error is not null or w.accepted_lineage_count <> 1))::bigint as invalid_rows
  from routing_lineage w cross join sample_clock c
),
delivery_open as (
  select d.*, e.source_system, e.recorded_at, s.active as subscription_active,
    s.queue_name
  from momi_events.deliveries d join momi_events.events e using (event_id)
  join momi_events.subscriptions s using (subscription_key)
),
delivery_classification as (
  select count(*) filter (where d.status not in ('delivered', 'dead_letter'))::bigint as open_rows,
    count(*) filter (where d.status in ('pending', 'queued') and d.next_attempt_at <= c.observed_at)::bigint as ready,
    count(*) filter (where d.status = 'running')::bigint as running,
    count(*) filter (where d.status = 'retry_wait')::bigint as retry_rows,
    count(*) filter (where d.status = 'dead_letter')::bigint as dead_rows,
    count(*) filter (where d.status not in ('delivered', 'dead_letter') and (
      d.status not in ('pending', 'queued') or d.attempt_count <> 0
      or d.next_attempt_at > c.observed_at or d.recorded_at > c.observed_at
      or d.lease_expires_at is not null
      or d.last_error is not null or d.source_system <> 'toast'
      or d.subscription_active is not true
      or ((d.status in ('queued', 'running')) <> (d.queue_message_id is not null))
      or (d.queue_message_id is not null and not (
        (d.queue_name = 'warehouse_projection_toast_v1' and exists (
          select 1 from pgmq.q_warehouse_projection_toast_v1 q
          where q.msg_id = d.queue_message_id))
        or (d.queue_name = 'order_alerting_v1' and exists (
          select 1 from pgmq.q_order_alerting_v1 q
          where q.msg_id = d.queue_message_id))))))::bigint
      + (count(*) filter (where d.status not in ('delivered', 'dead_letter')
          and d.queue_message_id is not null)
        - count(distinct concat_ws('|', d.queue_name, d.queue_message_id::text))
          filter (where d.status not in ('delivered', 'dead_letter')
            and d.queue_message_id is not null))::bigint as invalid_rows
  from delivery_open d cross join sample_clock c
),
toast_stage_candidates as (
  select j.*
  from toast_acquisition.jobs j cross join boundary_values b
  where j.job_id <= b.job_high_water and j.created_at <= b.started_at
    and (j.completed_at is null or j.completed_at >= b.started_at)
),
toast_stage_lineage as (
  select c.*, l.parent_job_id, l.fanout_matches
  from toast_stage_candidates c
  left join toast_lineage l using (job_id)
),
due_job_roots as (
  select ('schedule:' || d.schedule_key || ':' || d.due_at_utc_ms::text) as root_key,
    j.job_id
  from due_occurrences d
  join active_registry a using (schedule_key)
  join toast_acquisition.jobs j
    on j.idempotency_key = a.schedule_key || ':' || to_char(
      to_timestamp(d.due_at_utc_ms / 1000.0) at time zone 'UTC', 'YYYYMMDDHH24MISS')
    and (j.operation_key, j.source_key, j.restaurant_guid, j.mode) =
      (a.operation_key, a.source_key, a.restaurant_guid, a.mode)
),
fanout_parent_roots as (
  select distinct ('toast:' || c.parent_job_id::text) as root_key,
    c.parent_job_id as job_id
  from toast_stage_lineage c
  where c.fanout_matches = 1 and c.parent_job_id is not null
    and not exists (select 1 from due_job_roots due
      where due.job_id = c.parent_job_id)
),
toast_roots as (
  select ('toast:' || c.job_id::text) as root_key, c.job_id
  from toast_stage_lineage c
  where c.fanout_matches <> 1
    and not exists (select 1 from due_job_roots due where due.job_id = c.job_id)
  union select root_key, job_id from fanout_parent_roots
),
cohort_job_seeds as (
  select root_key, job_id from toast_roots
  union
  select root_key, job_id from due_job_roots
),
cohort_jobs as (
  select root_key, job_id from cohort_job_seeds
  union
  select parent.root_key, child.job_id
  from cohort_job_seeds parent
  join toast_lineage child on child.parent_job_id = parent.job_id
    and child.fanout_matches = 1
),
cohort_attempts as (
  select distinct c.root_key, a.attempt_id, a.job_id, a.finished_at,
    a.http_status, a.error_code, a.pagination_generation,
    j.pagination_generation as job_pagination_generation
  from cohort_jobs c join toast_raw.api_request_attempts a using (job_id)
  join toast_acquisition.jobs j using (job_id)
),
cohort_observations as (
  select distinct a.root_key, o.observation_id, o.attempt_id
  from cohort_attempts a join toast_raw.resource_observations o using (attempt_id)
),
routing_stage_rows as (
  select l.* from routing_lineage l cross join boundary_values b
  where l.recorded_at <= b.started_at
    and (l.completed_at is null or l.completed_at >= b.started_at)
    and l.accepted_lineage_count = 1
),
delivery_stage_rows as (
  select d.* from delivery_open d
  join momi_events.routing_work r using (event_id)
  cross join boundary_values b
  where r.completed_at < b.started_at
    and (d.delivered_at is null or d.delivered_at >= b.started_at)
),
event_origins as (
  select e.event_id, e.event_id as origin_event_id
  from momi_events.events e
  where e.source_system = 'toast' and e.event_name like 'source.toast.%'
  union all
  select p.child_event_id, p.parent_event_id
  from projector_parent_summary p where p.parent_count = 1
),
event_roots as (
  select distinct ('event:' || origin.origin_event_id::text) as root_key,
    origin.origin_event_id as event_id
  from (
    select event_id from routing_stage_rows
    union select event_id from delivery_stage_rows
  ) stage
  join event_origins origin using (event_id)
),
job_event_seeds as (
  select distinct o.root_key, e.event_id
  from cohort_observations o join source_observation_events e using (observation_id)
  union
  select distinct j.root_key, e.event_id
  from cohort_jobs j join source_job_events e using (job_id)
),
cohort_source_events as (
  select root_key, event_id from job_event_seeds
  union select root_key, event_id from event_roots
),
cohort_events as (
  select root_key, event_id from cohort_source_events
  union
  select parent.root_key, child.child_event_id
  from cohort_source_events parent
  join projector_parent_candidates child on child.parent_event_id = parent.event_id
  join projector_parent_summary summary on summary.child_event_id = child.child_event_id
    and summary.parent_count = 1
),
cohort_routing as (
  select distinct e.root_key, r.* from cohort_events e
  join momi_events.routing_work r using (event_id)
),
cohort_deliveries as (
  select distinct e.root_key, d.*, s.queue_name from cohort_events e
  join momi_events.deliveries d using (event_id)
  join momi_events.subscriptions s using (subscription_key)
),
cohort_reservations as (
  select distinct d.root_key, r.* from cohort_deliveries d
  join warehouse_projection.delivery_reservations r
    using (event_id, subscription_key)
),
toast_root_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', root_key, job_id::text), E'\n' order by root_key, job_id), ''),
      'UTF8'), 'sha256'), 'hex') as fingerprint from toast_roots
),
routing_root_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(event_id::text, E'\n'
      order by event_id), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from routing_stage_rows
),
delivery_root_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',
      event_id::text, subscription_key), E'\n' order by event_id, subscription_key), ''),
      'UTF8'), 'sha256'), 'hex') as fingerprint from delivery_stage_rows
),
current_queue_mapping_summary as (
  select count(*) filter (where queue_message_id is not null)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',
      event_id::text, subscription_key, queue_name, queue_message_id::text), E'\n'
      order by event_id, subscription_key) filter (where queue_message_id is not null), ''),
      'UTF8'), 'sha256'), 'hex') as fingerprint from delivery_stage_rows
),
queue_mapping_summary as (
  select coalesce((c.value ->> 'queueMappingCount')::bigint, q.rows) as rows,
    coalesce(c.value ->> 'queueMappingSha256', q.fingerprint) as fingerprint
  from sample_clock c cross join current_queue_mapping_summary q
),
cohort_root_rows as (
  select root_key from toast_roots
  union select root_key from event_roots
  union select ('schedule:' || schedule_key || ':' || due_at_utc_ms::text)
    from due_occurrences
),
cohort_root_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(root_key, E'\n'
      order by root_key), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from cohort_root_rows
),
cohort_membership_rows as (
  select 'root'::text as kind, root_key as identity, root_key from cohort_root_rows
  union all select 'job', job_id::text, root_key from cohort_jobs
  union all select 'attempt', attempt_id::text, root_key from cohort_attempts
  union all select 'observation', observation_id::text, root_key from cohort_observations
  union all select 'event', event_id::text, root_key from cohort_events
  union all select 'routing', event_id::text, root_key from cohort_routing
  union all select 'delivery', event_id::text || ':' || subscription_key, root_key
    from cohort_deliveries
  union all select 'queue', event_id::text || ':' || subscription_key, root_key
    from cohort_deliveries where status in ('queued', 'running', 'delivered')
),
cohort_membership_proof_rows as (
  select encode(extensions.digest(convert_to(concat_ws('|', kind, identity, root_key),
    'UTF8'), 'sha256'), 'hex') as member_sha256
  from cohort_membership_rows
),
cohort_membership_proof_summary as (
  select coalesce(jsonb_agg(member_sha256 order by member_sha256), '[]'::jsonb) as rows
  from cohort_membership_proof_rows
),
prior_membership_proof_rows as (
  select prior.member_sha256
  from sample_clock c cross join lateral jsonb_array_elements_text(
    coalesce(c.value -> 'priorMembershipProof', '[]'::jsonb)) prior(member_sha256)
),
cohort_membership_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|', kind,
      identity, root_key), E'\n' order by kind, identity, root_key), ''), 'UTF8'),
      'sha256'), 'hex') as fingerprint from cohort_membership_rows
),
cohort_lineage_edges as (
  select distinct ('job:' || parent.job_id) as parent,
    ('job:' || child.job_id) as child
  from cohort_jobs parent join toast_lineage child
    on child.parent_job_id = parent.job_id and child.fanout_matches = 1
  union select distinct ('job:' || job_id), ('attempt:' || attempt_id)
    from cohort_attempts
  union select distinct ('attempt:' || attempt_id), ('observation:' || observation_id)
    from cohort_observations
  union select distinct ('observation:' || o.observation_id), ('event:' || e.event_id)
    from cohort_observations o join source_observation_events e using (observation_id)
  union select distinct ('job:' || j.job_id), ('event:' || e.event_id)
    from cohort_jobs j join source_job_events e using (job_id)
  union select distinct ('event:' || parent_event_id), ('event:' || child_event_id)
    from projector_parent_candidates p
    where exists (select 1 from cohort_events e where e.event_id = p.child_event_id)
  union select distinct ('event:' || event_id), ('routing:' || event_id)
    from cohort_routing
  union select distinct ('routing:' || event_id),
    ('delivery:' || event_id || ':' || subscription_key) from cohort_deliveries
  union select distinct ('delivery:' || event_id || ':' || subscription_key),
    ('queue:' || event_id || ':' || subscription_key) from cohort_deliveries
    where status in ('queued', 'running', 'delivered')
),
cohort_lineage_proof_rows as (
  select encode(extensions.digest(convert_to(child, 'UTF8'), 'sha256'), 'hex')
      as child_sha256,
    encode(extensions.digest(convert_to(parent, 'UTF8'), 'sha256'), 'hex')
      as parent_sha256,
    encode(extensions.digest(convert_to(parent || '|' || child, 'UTF8'), 'sha256'), 'hex')
      as edge_sha256
  from cohort_lineage_edges
),
cohort_lineage_proof_summary as (
  select coalesce(jsonb_agg(jsonb_build_object('childSha256', child_sha256,
    'parentSha256', parent_sha256, 'edgeSha256', edge_sha256)
    order by edge_sha256), '[]'::jsonb) as rows
  from cohort_lineage_proof_rows
),
prior_lineage_proof_rows as (
  select prior.value ->> 'childSha256' as child_sha256,
    prior.value ->> 'parentSha256' as parent_sha256,
    prior.value ->> 'edgeSha256' as edge_sha256
  from sample_clock c cross join lateral jsonb_array_elements(
    coalesce(c.value -> 'priorLineageProof', '[]'::jsonb)) prior(value)
),
membership_delta_summary as (
  select
    (select count(*) from prior_membership_proof_rows)::bigint as prior_rows,
    encode(extensions.digest(convert_to(coalesce((select string_agg(member_sha256,
      E'\n' order by member_sha256) from prior_membership_proof_rows), ''), 'UTF8'),
      'sha256'), 'hex') as prior_fingerprint,
    (select count(*) from cohort_membership_proof_rows current
      where not exists (select 1 from prior_membership_proof_rows prior
        where prior.member_sha256 = current.member_sha256))::bigint as addition_rows,
    encode(extensions.digest(convert_to(coalesce((select string_agg(current.member_sha256,
      E'\n' order by current.member_sha256) from cohort_membership_proof_rows current
      where not exists (select 1 from prior_membership_proof_rows prior
        where prior.member_sha256 = current.member_sha256)), ''), 'UTF8'), 'sha256'),
      'hex') as addition_fingerprint,
    (select count(*) from prior_membership_proof_rows prior
      where not exists (select 1 from cohort_membership_proof_rows current
        where current.member_sha256 = prior.member_sha256))::bigint as missing_rows,
    encode(extensions.digest(convert_to(coalesce((select string_agg(prior.member_sha256,
      E'\n' order by prior.member_sha256) from prior_membership_proof_rows prior
      where not exists (select 1 from cohort_membership_proof_rows current
        where current.member_sha256 = prior.member_sha256)), ''), 'UTF8'), 'sha256'),
      'hex') as missing_fingerprint
),
lineage_delta_summary as (
  select
    (select count(*) from prior_lineage_proof_rows prior
      where not exists (select 1 from cohort_lineage_proof_rows current
        where current.edge_sha256 = prior.edge_sha256))::bigint as missing_rows,
    encode(extensions.digest(convert_to(coalesce((select string_agg(prior.edge_sha256,
      E'\n' order by prior.edge_sha256) from prior_lineage_proof_rows prior
      where not exists (select 1 from cohort_lineage_proof_rows current
        where current.edge_sha256 = prior.edge_sha256)), ''), 'UTF8'), 'sha256'),
      'hex') as missing_fingerprint,
    (select count(distinct prior.child_sha256) from prior_lineage_proof_rows prior
      join cohort_lineage_proof_rows current using (child_sha256)
      where current.parent_sha256 <> prior.parent_sha256)::bigint as changed_parent_rows,
    encode(extensions.digest(convert_to(coalesce((select string_agg(distinct
      concat_ws('|', prior.child_sha256, prior.parent_sha256, current.parent_sha256),
      E'\n' order by concat_ws('|', prior.child_sha256, prior.parent_sha256,
        current.parent_sha256)) from prior_lineage_proof_rows prior
      join cohort_lineage_proof_rows current using (child_sha256)
      where current.parent_sha256 <> prior.parent_sha256), ''), 'UTF8'), 'sha256'),
      'hex') as changed_parent_fingerprint
),
cohort_lineage_summary as (
  select count(*)::bigint as rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|', parent,
      child), E'\n' order by parent, child), ''), 'UTF8'), 'sha256'), 'hex')
      as fingerprint from cohort_lineage_edges
),
cohort_ambiguity as (
  select count(*)::bigint as rows from (
    select kind, identity from cohort_membership_rows
    group by kind, identity having count(distinct root_key) <> 1
  ) ambiguous
),
cohort_queue_validation as (
  select count(*) filter (where d.queue_message_id is not null and not (
      (d.queue_name = 'warehouse_projection_toast_v1' and exists (
        select 1 from pgmq.q_warehouse_projection_toast_v1 q
        where q.msg_id = d.queue_message_id))
      or (d.queue_name = 'order_alerting_v1' and exists (
        select 1 from pgmq.q_order_alerting_v1 q
        where q.msg_id = d.queue_message_id))))::bigint
      + (count(*) filter (where d.queue_message_id is not null)
        - count(distinct concat_ws('|', d.queue_name, d.queue_message_id::text)))::bigint
      as invalid_rows
  from cohort_deliveries d
),
cohort_state as (
  select
    (select count(distinct job_id) from cohort_jobs)::bigint as job_count,
    (select count(distinct c.job_id) from cohort_jobs c join toast_acquisition.jobs j
      using (job_id) where j.status <> 'succeeded')::bigint as job_open,
    (select count(*) from cohort_attempts)::bigint as attempt_count,
    (select count(*) from cohort_attempts where finished_at is null)::bigint as attempt_open,
    (select count(*) from cohort_observations)::bigint as observation_count,
    (select count(distinct event_id) from cohort_events)::bigint as event_count,
    (select count(distinct event_id) from cohort_routing)::bigint as routing_count,
    (select count(distinct event_id) from cohort_routing
      where status <> 'succeeded')::bigint as routing_open,
    (select count(*) from cohort_deliveries)::bigint as delivery_count,
    (select count(*) from cohort_deliveries
      where status not in ('delivered', 'dead_letter'))::bigint as delivery_open,
    (select count(*) from cohort_deliveries where queue_message_id is not null)::bigint as queue_open,
    (select count(*) from cohort_reservations)::bigint as reservation_open,
    ((select count(*) from cohort_jobs c join toast_acquisition.jobs j using (job_id)
        where j.status = 'dead_letter')
      + (select count(*) from cohort_routing where status = 'dead_letter')
      + (select count(*) from cohort_deliveries where status = 'dead_letter'))::bigint as dead_rows,
    ((select count(*) from cohort_jobs c join toast_acquisition.jobs j using (job_id)
        where j.status = 'retry_wait')
      + (select count(*) from cohort_routing where status = 'retry_wait')
      + (select count(*) from cohort_deliveries where status = 'retry_wait'))::bigint as retry_rows,
    ((select count(*) from cohort_attempts where
          pagination_generation > job_pagination_generation
          or (finished_at is not null and (error_code is not null
            or http_status is null or http_status not between 200 and 299)))
      + (select count(*) from cohort_deliveries where
          (status in ('queued', 'running')) <> (queue_message_id is not null)
          or (status = 'delivered' and queue_message_id is not null))
      + (select count(*) from cohort_routing where status not in
          ('pending', 'running', 'succeeded'))
      + (select count(*) from cohort_deliveries where status not in
          ('pending', 'queued', 'running', 'delivered'))
      + (select invalid_rows from cohort_queue_validation))::bigint as invalid_rows,
    ((select count(distinct c.job_id) from cohort_jobs c join toast_acquisition.jobs j
        using (job_id) where j.status <> 'succeeded')
      + (select count(distinct event_id) from cohort_routing where status <> 'succeeded')
      + (select count(*) from cohort_deliveries
          where status not in ('delivered', 'dead_letter')))::bigint
      as emittable_parents,
    ((select count(distinct c.job_id) from cohort_jobs c join toast_acquisition.jobs j
        using (job_id) where j.status = 'succeeded')
      + (select count(*) from cohort_attempts where finished_at is not null)
      + (select count(distinct event_id) from cohort_routing where status = 'succeeded')
      + (select count(*) from cohort_deliveries where status = 'delivered'))::bigint
      as terminal_count
),
cohort_boundary as (
  select encode(extensions.digest(convert_to(concat_ws('|',
    floor(extract(epoch from b.started_at) * 1000)::bigint::text,
    b.job_high_water::text, b.observation_high_water::text,
    due.fingerprint, roots.fingerprint, toast.fingerprint, routing.fingerprint,
    delivery.fingerprint, queue.fingerprint, registry.fingerprint,
    catalog.fingerprint), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from boundary_values b cross join due_occurrence_summary due
  cross join cohort_root_summary roots cross join toast_root_summary toast
  cross join routing_root_summary routing cross join delivery_root_summary delivery
  cross join queue_mapping_summary queue cross join registry_summary registry
  cross join routing_catalog_summary catalog
),
queue_totals as (
  select coalesce(sum(queue_length) filter (where queue_name in
    ('warehouse_projection_toast_v1', 'order_alerting_v1')), 0)::bigint as ready,
    coalesce(sum(queue_length) filter (where queue_name in
    ('warehouse_projection_toast_v1_dead_letter', 'order_alerting_v1_dead_letter')), 0)::bigint as dead
  from pgmq.metrics_all()
),
job_state as (
  select jsonb_agg(jsonb_build_object('jobId', jobid, 'jobName', jobname,
    'schedule', schedule, 'commandMd5', md5(command), 'active', active)
    order by jobid) as jobs from cron.job where jobid in (2, 3, 4, 11)
),
database_statistics as (
  select deadlocks, numbackends from pg_stat_database where datname = current_database()
),
worker_violations as (
  select count(*)::bigint as rows from (
    select j.operation_key, j.restaurant_guid
    from toast_acquisition.jobs j join toast_acquisition.operations o using (operation_key)
    where o.worker_batch_enabled and ((j.status = 'running' and j.lease_expires_at > now())
      or (j.status in ('pending', 'retry_wait') and j.last_dispatched_at > now() - interval '30 seconds'))
    group by j.operation_key, j.restaurant_guid, o.maximum_active_workers
    having count(*) > o.maximum_active_workers
  ) violations
)
select jsonb_build_object(
  'observedAtUtcMs', floor(extract(epoch from c.observed_at) * 1000)::bigint,
  'cohortStartedAtUtcMs', floor(extract(epoch from b.started_at) * 1000)::bigint,
  'jobHighWater', b.job_high_water, 'observationHighWater', b.observation_high_water,
  'dueOccurrences', due_rows.rows, 'cohortBoundarySha256', boundary.fingerprint,
  'cohortRootCount', roots.rows, 'cohortRootSha256', roots.fingerprint,
  'toastRootCount', toast_roots_summary.rows,
  'toastRootSha256', toast_roots_summary.fingerprint,
  'routingRootCount', routing_roots_summary.rows,
  'routingRootSha256', routing_roots_summary.fingerprint,
  'deliveryRootCount', delivery_roots_summary.rows,
  'deliveryRootSha256', delivery_roots_summary.fingerprint,
  'queueMappingCount', queue_boundary.rows,
  'queueMappingSha256', queue_boundary.fingerprint,
  'cohortMembershipCount', members.rows, 'cohortMembershipSha256', members.fingerprint,
  'cohortMembershipProof', member_proof.rows,
  'cohortLineageEdgeCount', edges.rows, 'cohortLineageEdgeSha256', edges.fingerprint,
  'cohortLineageProof', lineage_proof.rows,
  'priorCohortMembershipCount', member_delta.prior_rows,
  'priorCohortMembershipSha256', member_delta.prior_fingerprint,
  'cohortMembershipAdditionCount', member_delta.addition_rows,
  'cohortMembershipAdditionSha256', member_delta.addition_fingerprint,
  'cohortMissingPriorMemberCount', member_delta.missing_rows,
  'cohortMissingPriorMemberSha256', member_delta.missing_fingerprint,
  'cohortMissingPriorLineageEdgeCount', lineage_delta.missing_rows,
  'cohortMissingPriorLineageEdgeSha256', lineage_delta.missing_fingerprint,
  'cohortChangedParentCount', lineage_delta.changed_parent_rows,
  'cohortChangedParentSha256', lineage_delta.changed_parent_fingerprint,
  'cohortJobCount', cohort.job_count, 'cohortJobOpen', cohort.job_open,
  'cohortAttemptCount', cohort.attempt_count, 'cohortAttemptOpen', cohort.attempt_open,
  'cohortObservationCount', cohort.observation_count,
  'cohortEventCount', cohort.event_count, 'cohortRoutingCount', cohort.routing_count,
  'cohortRoutingOpen', cohort.routing_open, 'cohortDeliveryCount', cohort.delivery_count,
  'cohortDeliveryOpen', cohort.delivery_open, 'cohortQueueOpen', cohort.queue_open,
  'cohortReservationOpen', cohort.reservation_open, 'cohortDead', cohort.dead_rows,
  'cohortRetry', cohort.retry_rows, 'cohortInvalid', cohort.invalid_rows,
  'cohortAmbiguous', ambiguity.rows, 'cohortEmittableParents', cohort.emittable_parents,
  'cohortTerminalCount', cohort.terminal_count
) || jsonb_build_object(
  'maxCronRunId', (select coalesce(max(runid), 0)::bigint from cron.job_run_details),
  'targetJobs', j.jobs,
  'guardIdentityCount', (select count(*) from cron.job where jobname = 'momi-issue-330-canary-deadman-v1'),
  'activeCronExecutions', (select count(*) from pg_stat_activity where application_name ilike 'pg_cron%' and state = 'active'),
  'waitingLocks', (select count(*) from pg_locks where not granted and relation in
    ('toast_acquisition.jobs'::regclass, 'momi_events.routing_work'::regclass,
     'momi_events.deliveries'::regclass, 'cron.job'::regclass)),
  'registryCount', g.rows, 'registryContractViolations', g.contract_violations,
  'registrySha256', g.fingerprint, 'scheduleDueSha256', g.due_fingerprint,
  'routingCatalogCount', k.rows, 'routingCatalogSha256', k.fingerprint,
  'dueScheduleCount', (select count(*) from toast_acquisition.schedules
    where active and next_due_at <= c.observed_at),
  'toastOpen', t.open_rows, 'toastReady', t.ready, 'toastRunning', t.running,
  'toastRetry', t.retry_rows, 'toastDead', t.dead_rows, 'toastFuture', t.future_rows,
  'toastAttempted', t.attempted_rows, 'toastUnexpected', t.unexpected_rows,
  'toastPartial', t.partial_rows, 'toastUnmatched', t.unmatched_rows,
  'toastSha256', t.fingerprint,
  'routingOpen', r.open_rows, 'routingReady', r.ready, 'routingRunning', r.running,
  'routingRetry', r.retry_rows, 'routingDead', r.dead_rows, 'routingInvalid', r.invalid_rows,
  'deliveryOpen', d.open_rows, 'deliveryReady', d.ready, 'deliveryRunning', d.running,
  'deliveryRetry', d.retry_rows, 'deliveryDead', d.dead_rows,
  'deliveryInvalid', d.invalid_rows, 'queueReady', q.ready, 'queueDead', q.dead,
  'openAttempts', (select count(*) from toast_raw.api_request_attempts where finished_at is null),
  'projectionReservations', (select count(*) from warehouse_projection.delivery_reservations),
  'expiredLeases', (select count(*) from toast_acquisition.jobs where status = 'running' and lease_expires_at <= c.observed_at)
    + (select count(*) from momi_events.routing_work where status = 'running' and lease_expires_at <= c.observed_at)
    + (select count(*) from momi_events.deliveries where status = 'running' and lease_expires_at <= c.observed_at),
  'longLeases', (select count(*) from toast_acquisition.jobs where status = 'running' and lease_expires_at > c.observed_at + interval '120 seconds')
    + (select count(*) from momi_events.routing_work where status = 'running' and lease_expires_at > c.observed_at + interval '120 seconds')
    + (select count(*) from momi_events.deliveries where status = 'running' and lease_expires_at > c.observed_at + interval '120 seconds'),
  'workerCapViolations', w.rows
) || jsonb_build_object(
  'activeToastRouteCount', (select count(*) from momi_runtime.function_trigger_registry
    where function_key = 'toast.data.acquisition.v1' and active),
  'activeRoutingRouteCount', (select count(*) from momi_runtime.function_trigger_registry
    where function_key = 'momi.events.route.v1' and active),
  'activeProjectionEdgeRouteCount', (select count(*) from momi_runtime.function_trigger_registry
    where function_key = 'momi.warehouse_projection.toast.consume.v1' and active),
  'databaseProjectionModeCount', (select count(*) from warehouse_projection.worker_settings
    where subscription_key = 'warehouse-projection-toast-v1' and processor_mode = 'database'),
  'activeProjectionSubscriptionCount', (select count(*) from momi_events.subscriptions
    where subscription_key = 'warehouse-projection-toast-v1' and active),
  'routeContractViolations',
    (case when (select count(*) from momi_runtime.function_trigger_registry where
      trigger_key = 'toast.data.acquisition.http.v1' and function_key = 'toast.data.acquisition.v1'
      and contract_version = 1 and trigger_type = 'http' and http_method = 'POST'
      and route_path = '/functions/v1/toast-data-acquisition-v1'
      and authentication_policy_key = 'durable.capability_token.v1' and active
      and owner_service = 'toast-data-acquisition') = 1 then 0 else 1 end)
    + (case when (select count(*) from momi_runtime.function_trigger_registry where
      trigger_key = 'momi.events.route.http.v1' and function_key = 'momi.events.route.v1'
      and contract_version = 1 and trigger_type = 'http' and http_method = 'POST'
      and route_path = '/functions/v1/momi-event-router-v1'
      and authentication_policy_key = 'durable.work_token.v1' and active
      and owner_service = 'momi-event-routing') = 1 then 0 else 1 end)
    + (case when (select count(*) from momi_runtime.function_trigger_registry where
      trigger_key = 'momi.warehouse_projection.toast.http.v1'
      and function_key = 'momi.warehouse_projection.toast.consume.v1'
      and contract_version = 1 and trigger_type = 'http' and http_method = 'POST'
      and route_path = '/functions/v1/momi-warehouse-projection-worker-v1'
      and authentication_policy_key = 'durable.work_token.v1' and not active
      and owner_service = 'warehouse-projection') = 1 then 0 else 1 end),
  'databaseBytes', pg_database_size(current_database()),
  'cronHistoryBytes', pg_total_relation_size('cron.job_run_details'::regclass),
  'walDirectoryBytes', (select coalesce(sum(size), 0) from pg_ls_waldir()),
  'deadlocks', s.deadlocks, 'databaseBackends', s.numbackends,
  'maxConnections', current_setting('max_connections')::integer,
  'reservedConnections', current_setting('superuser_reserved_connections')::integer
) as sample
from sample_clock c cross join boundary_values b
cross join frozen_due_occurrences due_rows cross join cohort_boundary boundary
cross join cohort_root_summary roots cross join toast_root_summary toast_roots_summary
cross join routing_root_summary routing_roots_summary
cross join delivery_root_summary delivery_roots_summary
cross join queue_mapping_summary queue_boundary cross join cohort_membership_summary members
cross join cohort_membership_proof_summary member_proof
cross join cohort_lineage_summary edges cross join cohort_lineage_proof_summary lineage_proof
cross join membership_delta_summary member_delta cross join lineage_delta_summary lineage_delta
cross join cohort_ambiguity ambiguity
cross join cohort_state cohort cross join registry_summary g
cross join routing_catalog_summary k cross join toast_classification t
cross join routing_classification r cross join delivery_classification d
cross join queue_totals q cross join job_state j cross join database_statistics s
cross join worker_violations w;
