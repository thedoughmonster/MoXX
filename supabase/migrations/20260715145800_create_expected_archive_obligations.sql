-- service-owner: toast-data-acquisition

create table toast_acquisition.historical_coverage_bounds (
  policy_version text not null references
    toast_acquisition.coverage_policy_versions(policy_version),
  source_key text not null,
  restaurant_guid text not null,
  through_date date not null,
  primary key (policy_version, source_key, restaurant_guid),
  foreign key (source_key, restaurant_guid) references
    toast_acquisition.restaurants(source_key, restaurant_guid)
);
insert into toast_acquisition.historical_coverage_bounds
select 'toast-exit-archive-v1', source_key, restaurant_guid,
  date '2026-07-15'
from toast_acquisition.restaurants
where is_enabled or first_business_date is not null;
create table toast_acquisition.operation_coverage_dimensions (
  policy_version text not null,
  operation_key text not null,
  dimension_key text not null,
  coverage_dimensions jsonb not null,
  primary key (policy_version, operation_key, dimension_key),
  foreign key (policy_version, operation_key) references
    toast_acquisition.operation_coverage_policies (
      policy_version, operation_key
    ),
  constraint coverage_dimension_key_present
    check (nullif(dimension_key, '') is not null),
  constraint coverage_dimensions_are_object
    check (jsonb_typeof(coverage_dimensions) = 'object')
);
insert into toast_acquisition.operation_coverage_dimensions
select policy_version, operation_key, 'default', '{}'::jsonb
from toast_acquisition.operation_coverage_policies
where archive_class = 'historical'
  and operation_key not in (
    'toast.payments.list.v1', 'toast.labor.time_entries.v1'
  );
insert into toast_acquisition.operation_coverage_dimensions values
  ('toast-exit-archive-v1', 'toast.labor.time_entries.v1',
    'default', '{"includeMissedBreaks":true}'),
  ('toast-exit-archive-v1', 'toast.payments.list.v1',
    'paidBusinessDate', '{"date_selector":"paidBusinessDate"}'),
  ('toast-exit-archive-v1', 'toast.payments.list.v1',
    'refundBusinessDate', '{"date_selector":"refundBusinessDate"}'),
  ('toast-exit-archive-v1', 'toast.payments.list.v1',
    'voidBusinessDate', '{"date_selector":"voidBusinessDate"}');

create view toast_acquisition.expected_archive_obligations_v1
with (security_invoker = true)
as
with month_obligations as (
  select policy.policy_version,
    policy.operation_key || ':' || restaurant.restaurant_guid || ':'
      || series.month_start::date as obligation_key,
    policy.operation_key, restaurant.restaurant_guid,
    'backfill'::text as mode,
    dimension.coverage_dimensions,
    greatest(series.month_start::date,
      restaurant.first_business_date)::timestamp
      at time zone 'America/New_York' as window_start,
    least((series.month_start + interval '1 month')::date,
      bound.through_date + 1)::timestamp
      at time zone 'America/New_York' as window_end
  from toast_acquisition.operation_coverage_policies as policy
  join toast_acquisition.operation_coverage_dimensions as dimension
    using (policy_version, operation_key)
  join toast_acquisition.restaurants as restaurant
    on restaurant.first_business_date is not null
  join toast_acquisition.historical_coverage_bounds as bound
    on bound.policy_version = policy.policy_version
    and (bound.source_key, bound.restaurant_guid)
      = (restaurant.source_key, restaurant.restaurant_guid)
  cross join lateral generate_series(
    date_trunc('month', restaurant.first_business_date::timestamp),
    date_trunc('month', bound.through_date::timestamp), interval '1 month'
  ) as series(month_start)
  where policy.archive_class = 'historical'
    and policy.historical_window_kind = 'month'
), day_obligations as (
  select policy.policy_version,
    policy.operation_key || ':' || dimension.dimension_key || ':'
      || restaurant.restaurant_guid || ':' || series.business_date::date
      as obligation_key,
    policy.operation_key, restaurant.restaurant_guid,
    'backfill'::text as mode,
    dimension.coverage_dimensions,
    series.business_date::date::timestamp
      at time zone 'America/New_York' as window_start,
    (series.business_date::date + 1)::timestamp
      at time zone 'America/New_York' as window_end
  from toast_acquisition.operation_coverage_policies as policy
  join toast_acquisition.operation_coverage_dimensions as dimension
    using (policy_version, operation_key)
  join toast_acquisition.restaurants as restaurant
    on restaurant.first_business_date is not null
  join toast_acquisition.historical_coverage_bounds as bound
    on bound.policy_version = policy.policy_version
    and (bound.source_key, bound.restaurant_guid)
      = (restaurant.source_key, restaurant.restaurant_guid)
  cross join lateral generate_series(
    restaurant.first_business_date, bound.through_date, interval '1 day'
  ) as series(business_date)
  where policy.archive_class = 'historical'
    and policy.historical_window_kind = 'day'
)
select * from month_obligations
union all
select * from day_obligations;

alter table toast_acquisition.historical_coverage_bounds enable row level security;
alter table toast_acquisition.operation_coverage_dimensions enable row level security;
revoke all on toast_acquisition.historical_coverage_bounds,
  toast_acquisition.operation_coverage_dimensions,
  toast_acquisition.expected_archive_obligations_v1
  from public, anon, authenticated;

comment on view toast_acquisition.expected_archive_obligations_v1 is
  'Policy-derived historical obligations independent of acquisition jobs.';
