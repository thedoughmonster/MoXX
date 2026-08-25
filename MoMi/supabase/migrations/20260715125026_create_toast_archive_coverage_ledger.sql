-- service-owner: toast-data-acquisition

create table toast_acquisition.coverage_policy_versions (
  policy_version text primary key,
  effective_from date not null,
  target_completion_date date not null,
  is_frozen boolean not null default false,
  description text not null,
  constraint coverage_policy_version_present
    check (nullif(policy_version, '') is not null),
  constraint coverage_policy_dates_valid
    check (target_completion_date >= effective_from)
);

create table toast_acquisition.operation_coverage_policies (
  policy_version text not null references
    toast_acquisition.coverage_policy_versions(policy_version),
  operation_key text not null references
    toast_acquisition.operations(operation_key),
  archive_class text not null,
  historical_window_kind text,
  expected_schedule boolean not null,
  empty_response_allowed boolean not null,
  accepted_no_content_status integer,
  dependency_operation_key text references
    toast_acquisition.operations(operation_key),
  dependency_kind text,
  primary key (policy_version, operation_key),
  constraint operation_coverage_class_valid check (
    archive_class in ('historical', 'current_only', 'repair_only')
  ),
  constraint operation_coverage_window_valid check (
    historical_window_kind is null
    or historical_window_kind in ('day', 'month')
  ),
  constraint operation_coverage_dependency_valid check (
    (dependency_operation_key is null and dependency_kind is null)
    or (dependency_operation_key is not null and dependency_kind in (
      'each_resource', 'contemporaneous_snapshot', 'publication_advance'
    ))
  )
);

create table toast_acquisition.source_exclusions (
  exclusion_key text primary key,
  policy_version text not null references
    toast_acquisition.coverage_policy_versions(policy_version),
  api_area text not null,
  exclusion_kind text not null,
  reason text not null,
  active boolean not null default true,
  constraint source_exclusion_kind_valid check (
    exclusion_kind in (
      'paid', 'write', 'superseded', 'provider_only', 'covered_elsewhere'
    )
  )
);

insert into toast_acquisition.coverage_policy_versions values (
  'toast-exit-archive-v1', date '2026-07-14', date '2026-11-29', false,
  'Dough Monster Toast exit archive coverage contract.'
);

insert into toast_acquisition.operation_coverage_policies
select 'toast-exit-archive-v1', operation.operation_key,
  case when operation.exact_resource_only then 'repair_only'
    when operation.operation_key in (
      'toast.orders.bulk.v1', 'toast.payments.list.v1',
      'toast.cash.entries.v1', 'toast.cash.deposits.v1',
      'toast.labor.shifts.v1', 'toast.labor.time_entries.v1',
      'toast.kitchen.fulfillments.v1'
    ) then 'historical' else 'current_only' end,
  case when operation.operation_key in (
      'toast.orders.bulk.v1', 'toast.labor.shifts.v1',
      'toast.labor.time_entries.v1'
    ) then 'month'
    when operation.operation_key in (
      'toast.payments.list.v1', 'toast.cash.entries.v1',
      'toast.cash.deposits.v1', 'toast.kitchen.fulfillments.v1'
    ) then 'day' else null end,
  not operation.exact_resource_only,
  operation.response_kind = 'collection',
  case when operation.operation_key = 'toast.kitchen.fulfillments.v1'
    then 204 else null end,
  case when operation.operation_key = 'toast.payments.list.v1'
      then 'toast.payments.get.v1'
    when operation.operation_key in (
      'toast.stock.snapshot.v1', 'toast.menus.metadata.v1'
    ) then 'toast.menus.full.v1' else null end,
  case when operation.operation_key = 'toast.payments.list.v1'
      then 'each_resource'
    when operation.operation_key = 'toast.stock.snapshot.v1'
      then 'contemporaneous_snapshot'
    when operation.operation_key = 'toast.menus.metadata.v1'
      then 'publication_advance' else null end
from toast_acquisition.operations as operation where operation.is_enabled;

insert into toast_acquisition.source_exclusions values
  ('toast-paid-analytics', 'toast-exit-archive-v1', 'Analytics', 'paid', 'Paid Analytics is intentionally disabled.', true),
  ('toast-write-operations', 'toast-exit-archive-v1', 'Source writes', 'write', 'The exit archive is read-only.', true),
  ('toast-calculators', 'toast-exit-archive-v1', 'Price and discount calculators', 'write', 'Calculators do not preserve source records.', true),
  ('toast-provider-apis', 'toast-exit-archive-v1', 'Gift, loyalty, and tender providers', 'provider_only', 'Provider-facing APIs do not expose Dough Monster source history.', true),
  ('toast-menus-v3', 'toast-exit-archive-v1', 'Menus V3', 'superseded', 'Published menu and configuration reads cover the archive.', true),
  ('toast-deprecated-orders-get', 'toast-exit-archive-v1', 'Deprecated Orders GET', 'superseded', 'Orders V2 bulk and exact reads are authoritative.', true),
  ('toast-stock-search-post', 'toast-exit-archive-v1', 'Stock status search', 'covered_elsewhere', 'Inventory exceptions plus the menu universe preserve stock state.', true);

alter table toast_acquisition.coverage_policy_versions enable row level security;
alter table toast_acquisition.operation_coverage_policies enable row level security;
alter table toast_acquisition.source_exclusions enable row level security;
revoke all on all tables in schema toast_acquisition
  from public, anon, authenticated;
