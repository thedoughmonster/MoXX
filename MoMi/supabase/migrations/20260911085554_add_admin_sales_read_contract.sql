-- service-owner: warehouse-read-api

create schema momi_admin_reads;
revoke all on schema momi_admin_reads from public, anon, authenticated, service_role;

grant svc_warehouse_read_api to postgres with inherit false, set true;

create table momi_admin_reads.consumers_v1 (
  consumer_key text primary key,
  resource text not null check (resource = 'sales/health'),
  scope_key text not null,
  history_days integer not null check (history_days between 1 and 730),
  ordinary_ticket_limit numeric not null check (ordinary_ticket_limit > 0),
  enabled boolean not null default false,
  window_started_at timestamptz not null default '-infinity',
  window_requests integer not null default 0 check (window_requests between 0 and 6)
);

create table momi_admin_reads.capabilities_v1 (
  capability_token uuid primary key default gen_random_uuid(),
  consumer_key text not null references momi_admin_reads.consumers_v1,
  resource text not null check (resource = 'sales/health'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '30 seconds')
);
create index admin_read_capabilities_expiry_v1
  on momi_admin_reads.capabilities_v1 (expires_at);

alter table momi_admin_reads.consumers_v1 enable row level security;
alter table momi_admin_reads.capabilities_v1 enable row level security;
revoke all on momi_admin_reads.consumers_v1,
  momi_admin_reads.capabilities_v1 from public, anon, authenticated, service_role;
grant usage on schema momi_admin_reads, momi_analysis to svc_warehouse_read_api;
grant select on momi_admin_reads.consumers_v1,
  momi_analysis.orders_v1, momi_analysis.scopes_v1 to svc_warehouse_read_api;
grant update (window_started_at, window_requests)
  on momi_admin_reads.consumers_v1 to svc_warehouse_read_api;
grant select, insert, delete on momi_admin_reads.capabilities_v1
  to svc_warehouse_read_api;
grant update (consumed_at) on momi_admin_reads.capabilities_v1
  to svc_warehouse_read_api;
create policy admin_consumer_owner_read_v1 on momi_admin_reads.consumers_v1
  for select to svc_warehouse_read_api using (true);
create policy admin_consumer_owner_counter_v1 on momi_admin_reads.consumers_v1
  for update to svc_warehouse_read_api using (true) with check (true);
create policy admin_capability_owner_v1 on momi_admin_reads.capabilities_v1
  for all to svc_warehouse_read_api using (true) with check (true);

insert into momi_admin_reads.consumers_v1
  (consumer_key, resource, scope_key, history_days, ordinary_ticket_limit, enabled)
values ('dough-monster-admin', 'sales/health', 'primary', 730, 40, true);

create function momi_admin_reads.issue_read_capability_v1(
  p_consumer_key text, p_resource text
) returns uuid language plpgsql security invoker
set search_path = '' as $function$
declare
  v_consumer text;
  v_token uuid;
  v_now timestamptz := clock_timestamp();
begin
  if current_user <> 'svc_warehouse_read_api' then
    raise insufficient_privilege;
  end if;
  update momi_admin_reads.consumers_v1 as consumer
  set window_started_at = case
      when consumer.window_started_at <= v_now - interval '1 minute'
      then v_now else consumer.window_started_at end,
    window_requests = case
      when consumer.window_started_at <= v_now - interval '1 minute'
      then 1 else consumer.window_requests + 1 end
  where consumer.consumer_key = p_consumer_key and consumer.resource = p_resource
    and consumer.enabled and (consumer.window_started_at <= v_now - interval '1 minute'
      or consumer.window_requests < 6)
  returning consumer.consumer_key into v_consumer;
  if v_consumer is null then return null; end if;
  delete from momi_admin_reads.capabilities_v1
  where capability_token in (
    select stale.capability_token from momi_admin_reads.capabilities_v1 as stale
    where stale.expires_at < v_now - interval '1 day'
    order by stale.expires_at limit 128
  );
  insert into momi_admin_reads.capabilities_v1
    (consumer_key, resource, created_at, expires_at)
  values (v_consumer, p_resource, v_now, v_now + interval '30 seconds')
  returning capability_token into v_token;
  return v_token;
end
$function$;
revoke all on function momi_admin_reads.issue_read_capability_v1(text, text)
  from public, anon, authenticated, service_role;
grant execute on function momi_admin_reads.issue_read_capability_v1(text, text)
  to svc_warehouse_read_api;

create view momi_analysis.admin_sales_health_v1
with (security_invoker = true) as
with scope as materialized (
  select consumer.consumer_key, consumer.history_days, consumer.ordinary_ticket_limit,
    configured.scope_key, configured.location_id, configured.location_name,
    configured.timezone, configured.current_business_date
  from momi_admin_reads.consumers_v1 as consumer
  join momi_analysis.scopes_v1 as configured using (scope_key)
  where consumer.enabled and consumer.resource = 'sales/health'
), eligible as materialized (
  select scope.consumer_key, scope.ordinary_ticket_limit,
    recorded.business_date::text as date, recorded.total_amount,
    coalesce(nullif(recorded.channel_kind,''), nullif(recorded.channel,''), 'unknown') as channel,
    (floor((extract(hour from coalesce(recorded.submitted_at, recorded.opened_at)
      at time zone scope.timezone) * 60
      + extract(minute from coalesce(recorded.submitted_at, recorded.opened_at)
        at time zone scope.timezone)) / 15) * 15)::integer as minute
  from momi_analysis.orders_v1 as recorded
  join scope on recorded.location_id = scope.location_id
  where coalesce(recorded.voided, false) = false
    and recorded.business_date between
      scope.current_business_date - (scope.history_days - 1)
      and scope.current_business_date
), buckets as (
  select consumer_key, date, minute, channel,
    coalesce(sum(total_amount), 0) as sales, count(*)::integer as orders,
    coalesce(sum(total_amount) filter (where total_amount < ordinary_ticket_limit), 0)
      as ordinary_sales,
    count(*) filter (where total_amount < ordinary_ticket_limit)::integer as ordinary_orders
  from eligible where minute is not null
  group by consumer_key, date, minute, channel
), channels as (
  select consumer_key, date, channel, coalesce(sum(total_amount), 0) as sales,
    count(*)::integer as orders from eligible group by consumer_key, date, channel
), days as (
  select consumer_key, date, coalesce(sum(total_amount), 0) as sales,
    count(*)::integer as orders,
    coalesce(sum(total_amount) filter (where total_amount < ordinary_ticket_limit), 0)
      as ordinary_sales,
    count(*) filter (where total_amount < ordinary_ticket_limit)::integer as ordinary_orders,
    count(*) filter (where total_amount is null)::integer as missing_amounts,
    count(*) filter (where minute is null)::integer as missing_times
  from eligible group by consumer_key, date
)
select scope.consumer_key, jsonb_build_object(
  'schemaVersion', 1, 'capturedAt', statement_timestamp(),
  'timezone', scope.timezone, 'location', scope.location_name, 'bucketMinutes', 15,
  'latestObservation', (select max(recorded.source_observed_at)
    from momi_analysis.orders_v1 as recorded
    where recorded.location_id = scope.location_id),
  'days', coalesce((select jsonb_agg(jsonb_build_object(
    'date', d.date, 'sales', d.sales, 'orders', d.orders,
    'ordinarySales', d.ordinary_sales, 'ordinaryOrders', d.ordinary_orders,
    'missingAmounts', d.missing_amounts, 'missingTimes', d.missing_times,
    'buckets', coalesce((select jsonb_agg(jsonb_build_array(
      b.minute, b.sales, b.orders, b.ordinary_sales, b.ordinary_orders, b.channel)
      order by b.minute, b.channel) from buckets as b
      where b.consumer_key = d.consumer_key and b.date = d.date), '[]'::jsonb),
    'channels', (select jsonb_agg(jsonb_build_object(
      'channel', c.channel, 'sales', c.sales, 'orders', c.orders) order by c.channel)
      from channels as c where c.consumer_key = d.consumer_key and c.date = d.date)
  ) order by d.date) from days as d
    where d.consumer_key = scope.consumer_key), '[]'::jsonb)
) as dataset from scope;
revoke all on momi_analysis.admin_sales_health_v1
  from public, anon, authenticated, service_role;
grant select on momi_analysis.admin_sales_health_v1 to svc_warehouse_read_api;

create function momi_admin_reads.read_sales_health_v1(p_capability_token uuid)
returns jsonb language plpgsql security invoker
set search_path = '' as $function$
declare
  v_consumer text;
  v_dataset jsonb;
begin
  if current_user <> 'svc_warehouse_read_api' then
    raise insufficient_privilege;
  end if;
  update momi_admin_reads.capabilities_v1 as capability
  set consumed_at = clock_timestamp()
  where capability.capability_token = p_capability_token
    and capability.resource = 'sales/health' and capability.consumed_at is null
    and capability.expires_at > clock_timestamp()
    and exists (select 1 from momi_admin_reads.consumers_v1 as consumer
      where consumer.consumer_key = capability.consumer_key
        and consumer.resource = capability.resource and consumer.enabled)
  returning capability.consumer_key into v_consumer;
  if v_consumer is null then return null; end if;
  select report.dataset into v_dataset from momi_analysis.admin_sales_health_v1 as report
  where report.consumer_key = v_consumer;
  if octet_length(v_dataset::text) > 2000000 then
    raise exception using errcode = '54000', message = 'aggregate response too large';
  end if;
  return v_dataset;
end
$function$;
revoke all on function momi_admin_reads.read_sales_health_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function momi_admin_reads.read_sales_health_v1(uuid)
  to svc_warehouse_read_api;

