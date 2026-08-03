with
sample_clock as (
  select clock_timestamp() as observed_at
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
toast_open as (
  select j.* from toast_acquisition.jobs j where j.status <> 'succeeded'
),
toast_lineage as (
  select j.*, schedule.matches as schedule_matches,
    fanout.matches as fanout_matches,
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
  from toast_open j cross join sample_clock c
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
    select count(*)::bigint as matches,
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
      and split_part(j.idempotency_key, ':', 3) = parent.job_id::text
      and split_part(j.idempotency_key, ':', 4) = lower(j.parameters ->> 'guid')
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
),
toast_classification as (
  select count(*)::bigint as open_rows,
    count(*) filter (where j.status = 'pending' and j.next_attempt_at <= c.observed_at)::bigint as ready,
    count(*) filter (where j.status = 'running')::bigint as running,
    count(*) filter (where j.status = 'retry_wait')::bigint as retry_rows,
    count(*) filter (where j.status = 'dead_letter')::bigint as dead_rows,
    count(*) filter (where j.next_attempt_at > c.observed_at
      or j.created_at > c.observed_at or j.lineage_is_future)::bigint as future_rows,
    count(*) filter (where j.attempt_count <> 0)::bigint as attempted_rows,
    count(*) filter (where j.status <> 'pending')::bigint as unexpected_rows,
    count(*) filter (where j.lease_expires_at is not null
      or j.completed_at is not null or j.last_error is not null
      or ((j.page_count <> 0 or j.cursor <> '{}'::jsonb)
        and not j.legal_continuation))::bigint as partial_rows,
    count(*) filter (where j.accepted_lineage_count <> 1)::bigint as unmatched_rows,
    encode(extensions.digest(convert_to(coalesce(string_agg(
      concat_ws('|', j.job_id::text, j.idempotency_key, j.operation_key,
        j.source_key, j.restaurant_guid, j.mode, j.status, j.attempt_count::text),
      E'\n' order by j.job_id), ''), 'UTF8'), 'sha256'), 'hex') as fingerprint
  from toast_lineage j cross join sample_clock c
),
routing_open as (
  select w.*, e.source_system, e.source_resource_type, e.event_name,
    e.idempotency_key, e.schema_version, e.entity_type, e.entity_id, e.recorded_at
  from momi_events.routing_work w join momi_events.events e using (event_id)
  where w.status <> 'succeeded'
),
routing_lineage as (
  select w.*, matches.patterns as matching_subscription_patterns,
    matches.active_eligible as active_eligible_subscriptions,
    (case when w.source_system = 'toast' and w.event_name like 'source.toast.%'
        and matches.active_eligible = 1 then 1 else 0 end
      + case when w.event_name = 'warehouse.order.reconciled'
        and w.source_system = 'toast' and w.source_resource_type = 'order'
        and w.schema_version = 2 and w.entity_type = 'order'
        and w.entity_id is not null
        and w.idempotency_key ~ ('^warehouse:order:[0-9a-f]{8}-[0-9a-f]{4}-'
          || '[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
        and matches.patterns = 0 then 1 else 0 end
      + case when w.event_name = 'warehouse.stock.observed'
        and w.source_system = 'toast' and w.source_resource_type = 'stock_state'
        and w.schema_version = 1 and w.entity_type = 'menu_item'
        and w.entity_id is not null
        and w.idempotency_key ~ ('^warehouse:stock:[0-9a-f]{8}-[0-9a-f]{4}-'
          || '[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
        and matches.patterns = 0 then 1 else 0 end) as accepted_lineage_count
  from routing_open w
  cross join lateral (
    select count(*)::bigint as patterns,
      count(*) filter (where s.active
        and w.recorded_at >= s.minimum_recorded_at)::bigint as active_eligible
    from routing_catalog s where w.event_name like s.event_pattern
  ) matches
),
routing_classification as (
  select count(*)::bigint as open_rows,
    count(*) filter (where w.status = 'pending' and w.next_attempt_at <= c.observed_at)::bigint as ready,
    count(*) filter (where w.status = 'running')::bigint as running,
    count(*) filter (where w.status = 'retry_wait')::bigint as retry_rows,
    count(*) filter (where w.status = 'dead_letter')::bigint as dead_rows,
    count(*) filter (where w.status <> 'pending'
      or w.attempt_count <> 0 or w.next_attempt_at > c.observed_at
      or w.recorded_at > c.observed_at
      or w.lease_expires_at is not null or w.completed_at is not null
      or w.last_error is not null or w.accepted_lineage_count <> 1)::bigint as invalid_rows
  from routing_lineage w cross join sample_clock c
),
delivery_open as (
  select d.*, e.source_system, e.recorded_at, s.active as subscription_active
  from momi_events.deliveries d join momi_events.events e using (event_id)
  join momi_events.subscriptions s using (subscription_key)
  where d.status <> 'delivered'
),
delivery_classification as (
  select count(*) filter (where d.status <> 'dead_letter')::bigint as open_rows,
    count(*) filter (where d.status in ('pending', 'queued') and d.next_attempt_at <= c.observed_at)::bigint as ready,
    count(*) filter (where d.status = 'running')::bigint as running,
    count(*) filter (where d.status = 'retry_wait')::bigint as retry_rows,
    count(*) filter (where d.status = 'dead_letter')::bigint as dead_rows,
    count(*) filter (where d.status <> 'dead_letter' and (
      d.status not in ('pending', 'queued') or d.attempt_count <> 0
      or d.next_attempt_at > c.observed_at or d.recorded_at > c.observed_at
      or d.lease_expires_at is not null
      or d.last_error is not null or d.source_system <> 'toast'
      or d.subscription_active is not true))::bigint as invalid_rows
  from delivery_open d cross join sample_clock c
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
  'maxCronRunId', (select coalesce(max(runid), 0)::bigint from cron.job_run_details),
  'targetJobs', j.jobs,
  'guardIdentityCount', (select count(*) from cron.job where jobname = 'momi-issue-330-canary-deadman-v1'),
  'activeCronExecutions', (select count(*) from pg_stat_activity where application_name ilike 'pg_cron%' and state = 'active'),
  'waitingLocks', (select count(*) from pg_locks where not granted and relation in
    ('toast_acquisition.jobs'::regclass, 'momi_events.routing_work'::regclass,
     'momi_events.deliveries'::regclass, 'cron.job'::regclass)),
  'registryCount', g.rows, 'registryContractViolations', g.contract_violations,
  'registrySha256', g.fingerprint,
  'scheduleDueSha256', g.due_fingerprint,
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
  'deliveryRetry', d.retry_rows, 'deliveryDead', d.dead_rows, 'deliveryInvalid', d.invalid_rows,
  'queueReady', q.ready, 'queueDead', q.dead,
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
from sample_clock c cross join registry_summary g cross join routing_catalog_summary k
cross join toast_classification t
cross join routing_classification r cross join delivery_classification d
cross join queue_totals q cross join job_state j cross join database_statistics s
cross join worker_violations w;
