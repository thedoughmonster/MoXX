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
