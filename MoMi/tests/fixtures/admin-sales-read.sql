create role anon;
create role authenticated;
create role service_role;
create role svc_warehouse_read_api nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema momi_api;
create schema momi_analysis;
create schema toast_raw;
create table toast_raw.private_evidence (payload text);
create table momi_analysis.test_orders (
  location_id uuid, business_date date, total_amount numeric,
  channel_kind text, channel text, submitted_at timestamptz,
  opened_at timestamptz, voided boolean, source_observed_at timestamptz
);
create view momi_analysis.orders_v1 as select * from momi_analysis.test_orders;
create view momi_analysis.scopes_v1 as
select 'primary'::text as scope_key,
  '10000000-0000-4000-8000-000000000001'::uuid as location_id,
  'Berwick'::text as location_name, 'America/New_York'::text as timezone,
  (now() at time zone 'America/New_York')::date as current_business_date;
insert into momi_analysis.test_orders
select location_id, current_business_date + sample.day_offset, sample.amount,
  sample.kind, '', case when sample.minute is not null then
    ((current_business_date + sample.day_offset)::timestamp
      + sample.minute * interval '1 minute') at time zone timezone end,
  null, sample.voided, now() - interval '7 minutes'
from momi_analysis.scopes_v1 cross join (values
  (0, 10::numeric, 'counter', 365, false),
  (0, 50::numeric, 'delivery', 497, false),
  (0, 12::numeric, '', null::integer, false),
  (0, null::numeric, 'counter', 551, false),
  (0, 999::numeric, 'counter', 365, true),
  (0, 20::numeric, 'counter', 930, false),
  (-1, -5::numeric, 'counter', 830, false),
  (-729, 7::numeric, 'counter', 365, false),
  (-730, 999::numeric, 'counter', 365, false),
  (1, 444::numeric, 'counter', 365, false)
) as sample(day_offset, amount, kind, minute, voided);
insert into momi_analysis.test_orders
select '20000000-0000-4000-8000-000000000002', current_business_date,
  888, 'counter', '', now(), null, false, now()
from momi_analysis.scopes_v1;

create table momi_api.beta_analysis_scopes as
select scope_key, location_id, location_name, timezone, true as enabled
from momi_analysis.scopes_v1;
create schema warehouse_projection;
create schema momi_warehouse;
create table momi_warehouse.entities (
  entity_id uuid primary key, entity_type text, lifecycle_status text
);
create table momi_warehouse.entity_versions (
  entity_version_id uuid primary key default gen_random_uuid(),
  entity_id uuid references momi_warehouse.entities, canonical_document jsonb,
  source_observed_at timestamptz, projected_at timestamptz default now()
);
create index test_latest_version on momi_warehouse.entity_versions
  (entity_id, source_observed_at desc);
alter table momi_analysis.test_orders add column entity_id uuid default gen_random_uuid();
insert into momi_warehouse.entities
select entity_id, 'order', 'active' from momi_analysis.test_orders;
insert into momi_warehouse.entity_versions (entity_id, canonical_document, source_observed_at)
select entity_id, jsonb_build_object(
  'location_id', location_id, 'business_date', business_date,
  'opened_at', opened_at, 'submitted_at', submitted_at, 'voided', voided,
  'presentation', jsonb_build_object('total_amount', total_amount),
  'channel', channel, 'channel_kind', channel_kind,
  'customer_email', 'excluded@example.test'
), source_observed_at from momi_analysis.test_orders;
insert into momi_warehouse.entities values
  ('10000000-0000-4000-8000-000000000001', 'location', 'active'),
  ('30000000-0000-4000-8000-000000000003', 'order', 'inactive'),
  ('40000000-0000-4000-8000-000000000004', 'menu', 'active');
insert into momi_warehouse.entity_versions (entity_id, canonical_document, source_observed_at)
select entity_id, jsonb_build_object('location_id', '10000000-0000-4000-8000-000000000001',
  'business_date', (now() at time zone 'America/New_York')::date,
  'presentation', jsonb_build_object('total_amount', 999)), now()
from momi_warehouse.entities where entity_type in ('location','menu') or lifecycle_status='inactive';

-- Older observations and tied versions must never double-count or replace the winner.
insert into momi_warehouse.entity_versions
  (entity_id, canonical_document, source_observed_at, projected_at)
select version.entity_id, jsonb_set(version.canonical_document,
  '{presentation,total_amount}', '666'), version.source_observed_at - interval '1 hour',
  version.projected_at from momi_warehouse.entity_versions as version
join momi_analysis.test_orders as original using (entity_id)
where original.total_amount = 10;
insert into momi_warehouse.entity_versions
  (entity_id, canonical_document, source_observed_at, projected_at)
select version.entity_id, jsonb_set(version.canonical_document,
  '{presentation,total_amount}', '777'), version.source_observed_at,
  version.projected_at - interval '1 second' from momi_warehouse.entity_versions as version
join momi_analysis.test_orders as original using (entity_id)
where original.total_amount = 10 and version.canonical_document #>> '{presentation,total_amount}' = '10';
insert into momi_warehouse.entity_versions
  (entity_version_id, entity_id, canonical_document, source_observed_at, projected_at)
select '00000000-0000-0000-0000-000000000001', version.entity_id,
  jsonb_set(version.canonical_document, '{presentation,total_amount}', '778'),
  version.source_observed_at, version.projected_at
from momi_warehouse.entity_versions as version
join momi_analysis.test_orders as original using (entity_id)
where original.total_amount = 10 and version.canonical_document #>> '{presentation,total_amount}' = '10';
