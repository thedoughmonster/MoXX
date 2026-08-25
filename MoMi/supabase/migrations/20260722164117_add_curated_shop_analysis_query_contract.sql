-- service-owner: warehouse-read-api

create schema momi_analysis;
revoke all on schema momi_analysis from public, anon, authenticated, service_role;

create table momi_api.beta_analysis_scopes (
  scope_key text primary key,
  location_id uuid,
  location_name text not null,
  timezone text not null,
  enabled boolean not null default false,
  constraint beta_analysis_scope_key_valid
    check (scope_key ~ '^[a-z][a-z0-9_]*$'),
  constraint beta_analysis_location_name_present
    check (length(location_name) between 1 and 200),
  constraint beta_analysis_timezone_present
    check (length(timezone) between 1 and 100)
);

insert into momi_api.beta_analysis_scopes (
  scope_key, location_name, timezone, enabled
) values ('primary', 'Berwick', 'America/New_York', true);

create table momi_api.beta_analysis_catalog (
  relation_name text primary key,
  description text not null,
  columns jsonb not null,
  enabled boolean not null default false,
  constraint beta_analysis_relation_name_valid
    check (relation_name ~ '^[a-z][a-z0-9_]*_v[0-9]+$'),
  constraint beta_analysis_description_present
    check (length(description) between 1 and 500),
  constraint beta_analysis_columns_are_array
    check (jsonb_typeof(columns) = 'array' and jsonb_array_length(columns) > 0)
);

create view momi_analysis.scopes_v1 with (security_invoker = false) as
select scope.scope_key,
  coalesce(scope.location_id, location.entity_id) as location_id,
  scope.location_name,
  scope.timezone,
  (current_timestamp at time zone scope.timezone)::date as current_business_date
from momi_api.beta_analysis_scopes as scope
left join lateral (
  select entity.entity_id
  from momi_api.warehouse_entities_by_id_v1 as entity
  where entity.entity_type = 'location'
  order by entity.entity_id
  limit 1
) as location on true
where scope.enabled;

create view momi_analysis.orders_v1 with (security_invoker = false) as
select source.order_id,
  (source.order_document ->> 'location_id')::uuid as location_id,
  (source.order_document ->> 'business_date')::date as business_date,
  (source.order_document ->> 'opened_at')::timestamptz as opened_at,
  (source.order_document ->> 'submitted_at')::timestamptz as submitted_at,
  (source.order_document ->> 'closed_at')::timestamptz as closed_at,
  source.order_document ->> 'channel' as channel,
  source.order_document ->> 'channel_kind' as channel_kind,
  source.order_document #>> '{fulfillment,timing}' as fulfillment_timing,
  (source.order_document ->> 'guest_count')::integer as guest_count,
  coalesce((source.order_document ->> 'voided')::boolean, false) as voided,
  source.order_presentation ->> 'display_number' as display_number,
  (source.order_presentation ->> 'item_count')::numeric as item_count,
  (source.order_presentation ->> 'total_amount')::numeric as total_amount,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.orders_by_id_v1 as source;

create view momi_analysis.order_items_v1 with (security_invoker = false) as
select source.order_id,
  (source.order_document ->> 'location_id')::uuid as location_id,
  (source.order_document ->> 'business_date')::date as business_date,
  source.order_presentation ->> 'display_number' as display_number,
  item.name as item_name,
  item.quantity,
  item.modifiers,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.orders_by_id_v1 as source
cross join lateral jsonb_to_recordset(
  coalesce(source.order_presentation -> 'items', '[]'::jsonb)
) as item(name text, quantity numeric, modifiers jsonb);

create view momi_analysis.payments_v1 with (security_invoker = false) as
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
from momi_api.payments_by_id_v1 as source
join lateral (
  select configured.timezone
  from momi_api.beta_analysis_scopes as configured
  where configured.enabled
    and (configured.location_id is null
      or configured.location_id = (source.canonical_document ->> 'location_id')::uuid)
  order by configured.scope_key
  limit 1
) as scope on true;

create view momi_analysis.menu_items_v1 with (security_invoker = false) as
select source.entity_id as menu_item_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  source.canonical_document ->> 'name' as item_name,
  source.canonical_document ->> 'display_name' as display_name,
  (source.canonical_document ->> 'price_amount')::numeric as price_amount,
  (source.canonical_document ->> 'active')::boolean as active,
  (source.canonical_document ->> 'online_orderable')::boolean as online_orderable,
  source.canonical_document -> 'sales_channels' as sales_channels,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.menu_entities_by_id_v1 as source
where source.entity_type = 'menu_item';

create view momi_analysis.schedules_v1 with (security_invoker = false) as
select source.entity_id as schedule_id,
  (source.canonical_document ->> 'location_id')::uuid as location_id,
  source.canonical_document ->> 'schedule_kind' as schedule_kind,
  source.canonical_document ->> 'timezone' as timezone,
  (source.canonical_document ->> 'active')::boolean as active,
  source.canonical_document -> 'weekly_periods' as weekly_periods,
  source.canonical_document -> 'date_exceptions' as date_exceptions,
  (source.freshness ->> 'observed_at')::timestamptz as source_observed_at
from momi_api.schedules_by_id_v1 as source;

create view momi_analysis.time_entries_v1 with (security_invoker = false) as
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
from momi_api.warehouse_entities_by_id_v1 as source
where source.entity_type = 'time_entry';

insert into momi_api.beta_analysis_catalog (
  relation_name, description, columns, enabled
) values
  ('scopes_v1', 'Shop identity, timezone, and current local business date.',
    '["scope_key:text","location_id:uuid","location_name:text","timezone:text","current_business_date:date"]', true),
  ('orders_v1', 'Orders without customer identity; use business_date for daily reporting.',
    '["order_id:uuid","location_id:uuid","business_date:date","opened_at:timestamptz","submitted_at:timestamptz","closed_at:timestamptz","channel:text","channel_kind:text","fulfillment_timing:text","guest_count:integer","voided:boolean","display_number:text","item_count:numeric","total_amount:numeric","source_observed_at:timestamptz"]', true),
  ('order_items_v1', 'Order item quantities and modifiers without customer identity.',
    '["order_id:uuid","location_id:uuid","business_date:date","display_number:text","item_name:text","quantity:numeric","modifiers:jsonb","source_observed_at:timestamptz"]', true),
  ('payments_v1', 'Payment and tip facts without customer or card identity.',
    '["payment_id:uuid","location_id:uuid","paid_at:timestamptz","business_date:date","amount:numeric","tip_amount:numeric","payment_type:text","card_type:text","status:text","source_observed_at:timestamptz"]', true),
  ('menu_items_v1', 'Current menu item names, prices, availability, and sales channels.',
    '["menu_item_id:uuid","location_id:uuid","item_name:text","display_name:text","price_amount:numeric","active:boolean","online_orderable:boolean","sales_channels:jsonb","source_observed_at:timestamptz"]', true),
  ('schedules_v1', 'Current operating schedules and date exceptions.',
    '["schedule_id:uuid","location_id:uuid","schedule_kind:text","timezone:text","active:boolean","weekly_periods:jsonb","date_exceptions:jsonb","source_observed_at:timestamptz"]', true),
  ('time_entries_v1', 'Non-identifying labor hours and clock state by business date.',
    '["time_entry_id:uuid","location_id:uuid","business_date:date","starts_at:timestamptz","ends_at:timestamptz","regular_hours:numeric","overtime_hours:numeric","auto_clocked_out:boolean","source_observed_at:timestamptz"]', true);

create view momi_analysis.catalog_v1 with (security_invoker = false) as
select relation_name, description, columns
from momi_api.beta_analysis_catalog
where enabled
order by relation_name;

create function momi_analysis.execute_query_v1(p_sql text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, momi_analysis
as $$
declare
  result jsonb;
begin
  if current_user <> 'svc_communications_gateway'
    or current_setting('transaction_read_only') <> 'on'
    or p_sql is null or length(p_sql) > 6000
    or p_sql !~* '^\s*select\M'
    or p_sql ~ '(;|--|/\*)'
    or p_sql ~* '\m(insert|update|delete|merge|copy|call|do|set|reset|create|alter|drop|truncate|vacuum|analyze|explain)\M'
  then
    raise exception 'analysis_query_rejected';
  end if;
  execute format(
    'select jsonb_build_object(''rows'', coalesce(jsonb_agg(row_data order by ordinal) filter (where ordinal <= 100), ''[]''::jsonb), ''row_count'', least(count(*)::integer, 100), ''truncated'', count(*) > 100) from (select row_number() over () as ordinal, to_jsonb(query_row) as row_data from (%s) as query_row limit 101) as bounded',
    p_sql
  ) into result;
  if octet_length(result::text) > 65536 then
    raise exception 'analysis_result_too_large';
  end if;
  return result;
end;
$$;

alter table momi_api.beta_analysis_scopes enable row level security;
alter table momi_api.beta_analysis_catalog enable row level security;
revoke all on table momi_api.beta_analysis_scopes, momi_api.beta_analysis_catalog
  from public, anon, authenticated, service_role, svc_communications_gateway;
revoke all on all tables in schema momi_analysis
  from public, anon, authenticated, service_role;
revoke all on function momi_analysis.execute_query_v1(text)
  from public, anon, authenticated, service_role;
grant usage on schema momi_analysis to svc_communications_gateway;
grant select on all tables in schema momi_analysis to svc_communications_gateway;
grant execute on function momi_analysis.execute_query_v1(text)
  to svc_communications_gateway;

comment on schema momi_analysis is
  'Curated non-identifying relations for bounded MoMi shop analysis.';
comment on function momi_analysis.execute_query_v1(text) is
  'Executes one gateway-parsed SELECT under the declared read-only role.';
