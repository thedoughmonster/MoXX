-- service-owner: warehouse-read-api

create function momi_api.analysis_source_entities_v1()
returns table (
  entity_id uuid,
  entity_type text,
  canonical_document jsonb,
  freshness jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select source.entity_id, source.entity_type,
    source.canonical_document, source.freshness
  from momi_api.warehouse_entities_by_id_v1 as source
$$;

revoke all on function momi_api.analysis_source_entities_v1()
  from public, anon, authenticated, service_role;
grant execute on function momi_api.analysis_source_entities_v1()
  to svc_communications_gateway;

create or replace view momi_analysis.scopes_v1 with (security_invoker = false) as
select scope.scope_key,
  coalesce(scope.location_id, location.entity_id) as location_id,
  scope.location_name,
  scope.timezone,
  (current_timestamp at time zone scope.timezone)::date as current_business_date
from momi_api.beta_analysis_scopes as scope
left join lateral (
  select entity.entity_id
  from momi_api.analysis_source_entities_v1() as entity
  where entity.entity_type = 'location'
  order by entity.entity_id
  limit 1
) as location on true
where scope.enabled;

create or replace view momi_analysis.orders_v1 with (security_invoker = false) as
select source.entity_id as order_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  (source.canonical_document ->> 'business_date')::date as business_date,
  (source.canonical_document ->> 'opened_at')::timestamptz as opened_at,
  (source.canonical_document ->> 'submitted_at')::timestamptz as submitted_at,
  (source.canonical_document ->> 'closed_at')::timestamptz as closed_at,
  source.canonical_document ->> 'channel' as channel,
  source.canonical_document ->> 'channel_kind' as channel_kind,
  source.canonical_document #>> '{fulfillment,timing}' as fulfillment_timing,
  (source.canonical_document ->> 'guest_count')::integer as guest_count,
  coalesce((source.canonical_document ->> 'voided')::boolean, false) as voided,
  source.canonical_document #>> '{presentation,display_number}' as display_number,
  (source.canonical_document #>> '{presentation,item_count}')::numeric as item_count,
  (source.canonical_document #>> '{presentation,total_amount}')::numeric as total_amount,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.analysis_source_entities_v1() as source
where source.entity_type = 'order';

create or replace view momi_analysis.order_items_v1 with (security_invoker = false) as
select source.entity_id as order_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  (source.canonical_document ->> 'business_date')::date as business_date,
  source.canonical_document #>> '{presentation,display_number}' as display_number,
  item.name as item_name,
  item.quantity,
  item.modifiers,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.analysis_source_entities_v1() as source
cross join lateral jsonb_to_recordset(
  coalesce(source.canonical_document #> '{presentation,items}', '[]'::jsonb)
) as item(name text, quantity numeric, modifiers jsonb)
where source.entity_type = 'order';

create or replace view momi_analysis.payments_v1 with (security_invoker = false) as
select source.entity_id as payment_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  (source.canonical_document ->> 'paid_at')::timestamptz as paid_at,
  ((source.canonical_document ->> 'paid_at')::timestamptz
    at time zone scope.timezone)::date as business_date,
  (source.canonical_document ->> 'amount')::numeric as amount,
  (source.canonical_document ->> 'tip_amount')::numeric as tip_amount,
  source.canonical_document ->> 'payment_type' as payment_type,
  source.canonical_document ->> 'card_type' as card_type,
  source.canonical_document ->> 'status' as status,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.analysis_source_entities_v1() as source
join lateral (
  select configured.timezone
  from momi_api.beta_analysis_scopes as configured
  where configured.enabled
    and (configured.location_id is null
      or configured.location_id = (source.canonical_document ->> 'location_id')::uuid)
  order by configured.scope_key
  limit 1
) as scope on true
where source.entity_type = 'payment';

create or replace view momi_analysis.menu_items_v1 with (security_invoker = false) as
select source.entity_id as menu_item_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  source.canonical_document ->> 'name' as item_name,
  source.canonical_document ->> 'display_name' as display_name,
  (source.canonical_document ->> 'price_amount')::numeric as price_amount,
  (source.canonical_document ->> 'active')::boolean as active,
  (source.canonical_document ->> 'online_orderable')::boolean as online_orderable,
  source.canonical_document -> 'sales_channels' as sales_channels,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.analysis_source_entities_v1() as source
where source.entity_type = 'menu_item';

create or replace view momi_analysis.schedules_v1 with (security_invoker = false) as
select source.entity_id as schedule_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  source.canonical_document ->> 'schedule_kind' as schedule_kind,
  source.canonical_document ->> 'timezone' as timezone,
  (source.canonical_document ->> 'active')::boolean as active,
  source.canonical_document -> 'weekly_periods' as weekly_periods,
  source.canonical_document -> 'date_exceptions' as date_exceptions,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.analysis_source_entities_v1() as source
where source.entity_type = 'schedule';

create or replace view momi_analysis.time_entries_v1 with (security_invoker = false) as
select source.entity_id as time_entry_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  (source.canonical_document ->> 'business_date')::date as business_date,
  (source.canonical_document ->> 'starts_at')::timestamptz as starts_at,
  (source.canonical_document ->> 'ends_at')::timestamptz as ends_at,
  (source.canonical_document ->> 'regular_hours')::numeric as regular_hours,
  (source.canonical_document ->> 'overtime_hours')::numeric as overtime_hours,
  coalesce((source.canonical_document ->> 'auto_clocked_out')::boolean, false)
    as auto_clocked_out,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.analysis_source_entities_v1() as source
where source.entity_type = 'time_entry';
