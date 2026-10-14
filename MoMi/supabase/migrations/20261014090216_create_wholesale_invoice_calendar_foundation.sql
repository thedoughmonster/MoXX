-- service-owner: wholesale-invoicing
-- MOX-584: reviewed owner-only bootstrap; runtime access and sending remain off.
-- Exact project/history/transaction authority comes from MoXX deploy-dev, never a second coordinator.
-- Source review SHA-256: 79a913e78e02bb18428b170574a6d4a1551cf389993b0447d58f6a1531292df3
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(584, 20261014);

-- Source: supabase/migrations/20261012151218_create_wholesale_invoice_preview_foundation.sql
-- Source SHA-256: d5b6107816bf500cc8732e0919d65cd7691544d70b6eca8bed51ae12f1c20a72
create schema bridge;
-- Runtime role creation and schema USAGE are deferred.

create table bridge.invoice_policy_versions (
  policy_version integer primary key check (policy_version = 1),
  enabled boolean not null default false check (enabled = false),
  timezone text not null check (timezone = 'America/New_York'),
  basis text not null check (basis = 'standing_order'),
  tax_exempt boolean not null check (tax_exempt = true)
);
insert into bridge.invoice_policy_versions values
  (1, false, 'America/New_York', 'standing_order', true);

create table bridge.invoice_standing_orders (
  order_id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('dev', 'prod')),
  merchant_id text not null check (length(btrim(merchant_id)) between 1 and 128),
  location_id text not null check (length(btrim(location_id)) between 1 and 128),
  client_id text not null check (length(btrim(client_id)) between 1 and 128),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  protected_through date check (isfinite(protected_through)
    and extract(isodow from protected_through) = 7),
  identity_document jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  initial_effective_date date not null check (isfinite(initial_effective_date)),
  created_at timestamptz not null default now(),
  unique (environment, merchant_id, location_id, client_id)
);

create table bridge.invoice_standing_order_versions (
  version_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references bridge.invoice_standing_orders(order_id),
  revision integer not null check (revision > 0),
  command_id uuid not null,
  effective_from date not null check (isfinite(effective_from)),
  paused boolean not null,
  sending_hold boolean not null,
  notes text not null check (length(notes) <= 1000),
  request_document jsonb not null,
  result_document jsonb not null,
  created_at timestamptz not null default now(),
  unique (order_id, revision),
  unique (order_id, command_id)
);

create table bridge.invoice_version_weekday_lines (
  version_id uuid not null references bridge.invoice_standing_order_versions(version_id),
  weekday integer not null check (weekday between 1 and 7),
  catalog_item_id text not null check (length(btrim(catalog_item_id)) between 1 and 128),
  catalog_version text not null check (length(btrim(catalog_version)) between 1 and 128),
  item_name text not null check (length(btrim(item_name)) between 1 and 200),
  case_quantity integer not null check (case_quantity between 1 and 100000),
  case_price_minor bigint not null check (case_price_minor between 0 and 1000000000),
  catalog_snapshot jsonb not null check (jsonb_typeof(catalog_snapshot) = 'object'),
  primary key (version_id, weekday, catalog_item_id)
);

create table bridge.invoice_weeks (
  week_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references bridge.invoice_standing_orders(order_id),
  week_start date not null check (isfinite(week_start) and extract(isodow from week_start) = 1),
  unique (order_id, week_start)
);

create table bridge.invoice_weekly_snapshots (
  snapshot_id uuid primary key,
  week_id uuid not null references bridge.invoice_weeks(week_id),
  order_revision integer not null check (order_revision > 0),
  policy_version integer not null references bridge.invoice_policy_versions(policy_version),
  total_minor bigint not null check (total_minor between 0 and 9007199254740991),
  document jsonb not null,
  created_at timestamptz not null default now(),
  unique (week_id, order_revision)
);

create table bridge.invoice_weekly_snapshot_lines (
  snapshot_id uuid not null references bridge.invoice_weekly_snapshots(snapshot_id),
  service_date date not null check (isfinite(service_date)),
  version_id uuid not null references bridge.invoice_standing_order_versions(version_id),
  catalog_item_id text not null,
  line_document jsonb not null,
  primary key (snapshot_id, service_date, catalog_item_id)
);

alter table bridge.invoice_policy_versions enable row level security;
alter table bridge.invoice_standing_orders enable row level security;
alter table bridge.invoice_standing_order_versions enable row level security;
alter table bridge.invoice_version_weekday_lines enable row level security;
alter table bridge.invoice_weeks enable row level security;
alter table bridge.invoice_weekly_snapshots enable row level security;
alter table bridge.invoice_weekly_snapshot_lines enable row level security;

revoke all on table bridge.invoice_policy_versions,
  bridge.invoice_standing_orders, bridge.invoice_standing_order_versions,
  bridge.invoice_version_weekday_lines, bridge.invoice_weeks,
  bridge.invoice_weekly_snapshots, bridge.invoice_weekly_snapshot_lines
  from public, anon, authenticated, service_role;

create function bridge.invoice_validate_standing_order_v1(p_order jsonb, p_version jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  line jsonb;
  field text;
  date_value date;
begin
  if jsonb_typeof(p_order) is distinct from 'object'
    or jsonb_typeof(p_version) is distinct from 'object'
    or octet_length(p_order::text) + octet_length(p_version::text) > 1048576 then
    raise exception 'invoice_invalid_request' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_order) as k(key)
      where key not in ('environment', 'merchant_id', 'location_id', 'client_id',
        'currency', 'protected_through'))
    or exists (select 1 from jsonb_object_keys(p_version) as k(key)
      where key not in ('effective_from', 'paused', 'sending_hold', 'notes', 'lines')) then
    raise exception 'invoice_unknown_field' using errcode = '22023';
  end if;
  foreach field in array array['environment', 'merchant_id', 'location_id', 'client_id', 'currency'] loop
    if jsonb_typeof(p_order->field) is distinct from 'string'
      or length(btrim(p_order->>field)) not between 1 and 128
      or btrim(p_order->>field) <> p_order->>field then
      raise exception 'invoice_invalid_identity' using errcode = '22023';
    end if;
  end loop;
  if p_order->>'environment' not in ('dev', 'prod')
    or p_order->>'currency' !~ '^[A-Z]{3}$' then
    raise exception 'invoice_invalid_identity' using errcode = '22023';
  end if;
  if p_order ? 'protected_through' and p_order->'protected_through' <> 'null'::jsonb then
    if jsonb_typeof(p_order->'protected_through') is distinct from 'string'
      or p_order->>'protected_through' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invoice_invalid_protection_date' using errcode = '22023';
    end if;
    date_value := (p_order->>'protected_through')::date;
    if not isfinite(date_value) or extract(isodow from date_value) <> 7
      or to_char(date_value, 'YYYY-MM-DD') <> p_order->>'protected_through' then
      raise exception 'invoice_invalid_protection_date' using errcode = '22023';
    end if;
  end if;
  if jsonb_typeof(p_version->'effective_from') is distinct from 'string'
    or p_version->>'effective_from' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'invoice_invalid_effective_date' using errcode = '22023';
  end if;
  date_value := (p_version->>'effective_from')::date;
  if not isfinite(date_value) or to_char(date_value, 'YYYY-MM-DD') <> p_version->>'effective_from' then
    raise exception 'invoice_invalid_effective_date' using errcode = '22023';
  end if;
  if jsonb_typeof(p_version->'paused') is distinct from 'boolean'
    or jsonb_typeof(p_version->'sending_hold') is distinct from 'boolean'
    or jsonb_typeof(p_version->'notes') is distinct from 'string'
    or length(p_version->>'notes') > 1000
    or jsonb_typeof(p_version->'lines') is distinct from 'array' then
    raise exception 'invoice_invalid_schedule' using errcode = '22023';
  end if;
  if jsonb_array_length(p_version->'lines') > 100
    or (jsonb_array_length(p_version->'lines') = 0 and not (p_version->>'paused')::boolean) then
    raise exception 'invoice_invalid_line_count' using errcode = '22023';
  end if;
  for line in select value from jsonb_array_elements(p_version->'lines') loop
    if jsonb_typeof(line) is distinct from 'object' then
      raise exception 'invoice_invalid_line' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(line) as k(key)
        where key not in ('weekday', 'catalog_item_id', 'catalog_version', 'name',
          'case_quantity', 'case_price_minor', 'catalog_snapshot')) then
      raise exception 'invoice_unknown_line_field' using errcode = '22023';
    end if;
    foreach field in array array['catalog_item_id', 'catalog_version', 'name'] loop
      if jsonb_typeof(line->field) is distinct from 'string'
        or length(btrim(line->>field)) not between 1 and (case when field = 'name' then 200 else 128 end) then
        raise exception 'invoice_invalid_catalog_snapshot' using errcode = '22023';
      end if;
    end loop;
    foreach field in array array['weekday', 'case_quantity', 'case_price_minor'] loop
      if jsonb_typeof(line->field) is distinct from 'number' or line->>field !~ '^[0-9]+$' then
        raise exception 'invoice_invalid_integer' using errcode = '22023';
      end if;
    end loop;
    if (line->>'weekday')::numeric not between 1 and 7
      or (line->>'case_quantity')::numeric not between 1 and 100000
      or (line->>'case_price_minor')::numeric not between 0 and 1000000000
      or jsonb_typeof(line->'catalog_snapshot') is distinct from 'object' then
      raise exception 'invoice_invalid_line' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_version->'lines') as l(value)
    group by value->>'weekday', value->>'catalog_item_id' having count(*) > 1) then
    raise exception 'invoice_duplicate_weekday_item' using errcode = '22023';
  end if;
end;
$$;

create function bridge.invoice_save_standing_order_v1(
  p_command_id uuid, p_expected_revision integer, p_order jsonb, p_version jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_order bridge.invoice_standing_orders%rowtype;
  prior_command bridge.invoice_standing_order_versions%rowtype;
  request jsonb;
  identity_value jsonb;
  result jsonb;
  new_version uuid := gen_random_uuid();
  effective_date date;
begin
  if p_command_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invoice_invalid_command' using errcode = '22023';
  end if;
  perform bridge.invoice_validate_standing_order_v1(p_order, p_version);
  identity_value := p_order || jsonb_build_object('protected_through', p_order->'protected_through');
  request := jsonb_build_object('expected_revision', p_expected_revision,
    'order', identity_value, 'version', p_version);
  effective_date := (p_version->>'effective_from')::date;
  insert into bridge.invoice_standing_orders
    (environment, merchant_id, location_id, client_id, currency,
      protected_through, identity_document, initial_effective_date)
    values (p_order->>'environment', p_order->>'merchant_id', p_order->>'location_id',
      p_order->>'client_id', p_order->>'currency', (p_order->>'protected_through')::date,
      identity_value, effective_date)
    on conflict (environment, merchant_id, location_id, client_id) do nothing;
  select * into strict current_order from bridge.invoice_standing_orders
    where environment = p_order->>'environment' and merchant_id = p_order->>'merchant_id'
      and location_id = p_order->>'location_id' and client_id = p_order->>'client_id'
    for update;
  select * into prior_command from bridge.invoice_standing_order_versions
    where order_id = current_order.order_id and command_id = p_command_id;
  if found then
    if prior_command.request_document is distinct from request then
      raise exception 'invoice_command_conflict' using errcode = '22023';
    end if;
    return prior_command.result_document;
  end if;
  if current_order.identity_document is distinct from identity_value then
    raise exception 'invoice_identity_conflict' using errcode = '22023';
  end if;
  if current_order.revision <> p_expected_revision then
    raise exception 'invoice_revision_conflict' using errcode = '40001';
  end if;
  if effective_date < current_order.initial_effective_date
    or effective_date <= current_order.protected_through then
    raise exception 'invoice_protected_history' using errcode = '22023';
  end if;
  result := jsonb_build_object('order_id', current_order.order_id,
    'version_id', new_version, 'revision', current_order.revision + 1,
    'command_id', p_command_id, 'effective_from', p_version->>'effective_from');
  insert into bridge.invoice_standing_order_versions
    (version_id, order_id, revision, command_id, effective_from, paused,
      sending_hold, notes, request_document, result_document)
    values (new_version, current_order.order_id, current_order.revision + 1,
      p_command_id, effective_date, (p_version->>'paused')::boolean,
      (p_version->>'sending_hold')::boolean, p_version->>'notes', request, result);
  insert into bridge.invoice_version_weekday_lines
    (version_id, weekday, catalog_item_id, catalog_version, item_name,
      case_quantity, case_price_minor, catalog_snapshot)
    select new_version, (value->>'weekday')::integer, value->>'catalog_item_id',
      value->>'catalog_version', value->>'name', (value->>'case_quantity')::integer,
      (value->>'case_price_minor')::bigint, value->'catalog_snapshot'
    from jsonb_array_elements(p_version->'lines');
  update bridge.invoice_standing_orders set revision = current_order.revision + 1
    where order_id = current_order.order_id;
  return result;
end;
$$;

create function bridge.invoice_preview_week_v1(p_order_id uuid, p_week_start date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_order bridge.invoice_standing_orders%rowtype;
  policy bridge.invoice_policy_versions%rowtype;
  week_id_value uuid;
  snapshot_id_value uuid := gen_random_uuid();
  result jsonb;
  line_documents jsonb;
  day_documents jsonb;
  invoice_total numeric;
  held boolean;
begin
  if p_order_id is null or p_week_start is null or not isfinite(p_week_start)
    or extract(isodow from p_week_start) <> 1
    or p_week_start < date '2024-06-21' or p_week_start > date '9999-12-24' then
    raise exception 'invoice_invalid_week' using errcode = '22023';
  end if;
  select * into current_order from bridge.invoice_standing_orders
    where order_id = p_order_id for update;
  if not found then raise exception 'invoice_order_not_found' using errcode = '22023'; end if;
  if p_week_start <= current_order.protected_through then
    raise exception 'invoice_protected_history' using errcode = '22023';
  end if;
  select * into strict policy from bridge.invoice_policy_versions where policy_version = 1;
  if policy.enabled then raise exception 'invoice_delivery_must_remain_disabled'; end if;
  insert into bridge.invoice_weeks (order_id, week_start)
    values (p_order_id, p_week_start) on conflict (order_id, week_start) do nothing;
  select week_id into strict week_id_value from bridge.invoice_weeks
    where order_id = p_order_id and week_start = p_week_start;
  select document into result from bridge.invoice_weekly_snapshots
    where week_id = week_id_value and order_revision = current_order.revision;
  if found then return result; end if;

  with dates as (
    select p_week_start + n as service_date from generate_series(0, 6) as day(n)
  ), effective as (
    select d.service_date, v.version_id, v.paused, v.sending_hold, v.notes
    from dates d left join lateral (
      select * from bridge.invoice_standing_order_versions v
      where v.order_id = p_order_id and v.effective_from <= d.service_date
      order by v.revision desc limit 1
    ) v on true
  )
  select jsonb_agg(jsonb_build_object(
    'date', to_char(service_date, 'YYYY-MM-DD'), 'version_id', version_id,
    'state', case when version_id is null then 'not_started' when paused then 'paused' else 'scheduled' end,
    'sending_hold', coalesce(sending_hold, false), 'notes', coalesce(notes, '')
  ) order by service_date), coalesce(bool_or(sending_hold), false)
  into day_documents, held from effective;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', day->>'date', 'version_id', l.version_id,
    'catalog_item_id', l.catalog_item_id, 'catalog_version', l.catalog_version,
    'name', l.item_name, 'case_quantity', l.case_quantity,
    'case_price_minor', l.case_price_minor, 'currency', current_order.currency,
    'amount_minor', l.case_quantity::bigint * l.case_price_minor,
    'catalog_snapshot', l.catalog_snapshot,
    'notes', day->>'date' || ': ' || l.case_quantity::text || ' cases of ' || l.item_name ||
      ' (standing order)' || case when day->>'notes' = '' then '' else '; ' || (day->>'notes') end
  ) order by day->>'date', l.catalog_item_id collate "C"), '[]'::jsonb),
    coalesce(sum(l.case_quantity::numeric * l.case_price_minor), 0)
  into line_documents, invoice_total
  from jsonb_array_elements(day_documents) as d(day)
  join bridge.invoice_version_weekday_lines l on l.version_id = (day->>'version_id')::uuid
    and l.weekday = extract(isodow from (day->>'date')::date)::integer
  where day->>'state' = 'scheduled';
  if invoice_total > 9007199254740991 then
    raise exception 'invoice_total_out_of_range' using errcode = '22023';
  end if;
  result := jsonb_build_object('snapshot_id', snapshot_id_value, 'week_id', week_id_value,
    'order_id', p_order_id, 'order_revision', current_order.revision, 'policy_version', 1,
    'environment', current_order.environment, 'merchant_id', current_order.merchant_id,
    'location_id', current_order.location_id, 'client_id', current_order.client_id,
    'week_start', to_char(p_week_start, 'YYYY-MM-DD'),
    'week_end', to_char(p_week_start + 6, 'YYYY-MM-DD'),
    'timezone', policy.timezone, 'basis', policy.basis, 'enabled', policy.enabled,
    'sending_hold', held, 'currency', current_order.currency, 'tax_minor', 0,
    'subtotal_minor', invoice_total::bigint, 'total_minor', invoice_total::bigint,
    'dates', day_documents, 'lines', line_documents);
  insert into bridge.invoice_weekly_snapshots
    (snapshot_id, week_id, order_revision, policy_version, total_minor, document)
    values (snapshot_id_value, week_id_value, current_order.revision, 1, invoice_total::bigint, result);
  insert into bridge.invoice_weekly_snapshot_lines
    (snapshot_id, service_date, version_id, catalog_item_id, line_document)
    select snapshot_id_value, (value->>'date')::date, (value->>'version_id')::uuid,
      value->>'catalog_item_id', value from jsonb_array_elements(line_documents);
  return result;
end;
$$;

revoke all on function bridge.invoice_validate_standing_order_v1(jsonb, jsonb),
  bridge.invoice_save_standing_order_v1(uuid, integer, jsonb, jsonb),
  bridge.invoice_preview_week_v1(uuid, date)
  from public, anon, authenticated, service_role;
-- Runtime EXECUTE grants are deferred.

-- Source: supabase/migrations/20261014073003_add_invoice_calendar_contract.sql
-- Source SHA-256: c53b6a84ed5572e78a3df4412a1af41cf63938c5445caa761b0548b7a56d721e
-- Add metadata to the existing immutable revisions, never a second order store.
-- NULL means legacy/unverified, not delivery, active, or discontinued.
alter table bridge.invoice_standing_order_versions add column calendar_metadata jsonb;

create function bridge.invoice_calendar_version_guard_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'invoice_immutable_version' using errcode = '22023';
  end if;
  if exists (select 1 from bridge.invoice_standing_order_versions v
      where v.order_id = new.order_id and v.calendar_metadata->>'discontinued' = 'true') then
    raise exception 'invoice_discontinued_order' using errcode = '22023';
  end if;
  if new.calendar_metadata is null then
    if exists (select 1 from bridge.invoice_standing_order_versions v
        where v.order_id = new.order_id and v.calendar_metadata is not null) then
      raise exception 'invoice_calendar_save_v2_required' using errcode = '22023';
    end if;
    return new;
  end if;
  if jsonb_typeof(new.calendar_metadata) is distinct from 'object'
    or jsonb_typeof(new.calendar_metadata->'fulfillment') is distinct from 'string'
    or new.calendar_metadata->>'fulfillment' not in ('delivery', 'pickup')
    or jsonb_typeof(new.calendar_metadata->'discontinued') is distinct from 'boolean'
    or jsonb_typeof(new.calendar_metadata->'customer_name') is distinct from 'string'
    or length(btrim(new.calendar_metadata->>'customer_name')) not between 1 and 150
    or new.calendar_metadata->>'customer_name' ~ '[[:cntrl:]\[\]]' then
    raise exception 'invoice_invalid_calendar_metadata' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(new.calendar_metadata) k(key)
      where key not in ('fulfillment', 'discontinued', 'customer_name')) then
    raise exception 'invoice_unknown_calendar_field' using errcode = '22023';
  end if;
  if (new.calendar_metadata->>'discontinued')::boolean and not new.paused then
    raise exception 'invoice_discontinued_requires_pause' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger invoice_calendar_version_guard
before insert or update or delete on bridge.invoice_standing_order_versions
for each row execute function bridge.invoice_calendar_version_guard_v1();

create function bridge.invoice_save_standing_order_v2(
  p_command_id uuid, p_expected_revision integer, p_order jsonb, p_version jsonb, p_calendar jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_order bridge.invoice_standing_orders%rowtype;
  prior_command bridge.invoice_standing_order_versions%rowtype;
  request jsonb;
  identity_value jsonb;
  result jsonb;
  new_version uuid := gen_random_uuid();
  effective_date date;
begin
  if p_command_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_calendar is null or p_calendar = 'null'::jsonb or octet_length(p_calendar::text) > 2048 then
    raise exception 'invoice_invalid_command' using errcode = '22023';
  end if;
  perform bridge.invoice_validate_standing_order_v1(p_order, p_version);
  identity_value := p_order || jsonb_build_object('protected_through', p_order->'protected_through');
  request := jsonb_build_object('expected_revision', p_expected_revision,
    'order', identity_value, 'version', p_version, 'calendar', p_calendar);
  effective_date := (p_version->>'effective_from')::date;
  insert into bridge.invoice_standing_orders
    (environment, merchant_id, location_id, client_id, currency,
      protected_through, identity_document, initial_effective_date)
    values (p_order->>'environment', p_order->>'merchant_id', p_order->>'location_id',
      p_order->>'client_id', p_order->>'currency', (p_order->>'protected_through')::date,
      identity_value, effective_date)
    on conflict (environment, merchant_id, location_id, client_id) do nothing;
  select * into strict current_order from bridge.invoice_standing_orders
    where environment = p_order->>'environment' and merchant_id = p_order->>'merchant_id'
      and location_id = p_order->>'location_id' and client_id = p_order->>'client_id'
    for update;
  select * into prior_command from bridge.invoice_standing_order_versions
    where order_id = current_order.order_id and command_id = p_command_id;
  if found then
    if prior_command.request_document is distinct from request then
      raise exception 'invoice_command_conflict' using errcode = '22023';
    end if;
    return prior_command.result_document;
  end if;
  if current_order.identity_document is distinct from identity_value then
    raise exception 'invoice_identity_conflict' using errcode = '22023';
  end if;
  if current_order.revision <> p_expected_revision then
    raise exception 'invoice_revision_conflict' using errcode = '40001';
  end if;
  if effective_date < current_order.initial_effective_date or effective_date <= current_order.protected_through then
    raise exception 'invoice_protected_history' using errcode = '22023';
  end if;
  result := jsonb_build_object('order_id', current_order.order_id,
    'version_id', new_version, 'revision', current_order.revision + 1,
    'command_id', p_command_id, 'effective_from', p_version->>'effective_from');
  insert into bridge.invoice_standing_order_versions
    (version_id, order_id, revision, command_id, effective_from, paused,
      sending_hold, notes, request_document, result_document, calendar_metadata)
    values (new_version, current_order.order_id, current_order.revision + 1,
      p_command_id, effective_date, (p_version->>'paused')::boolean,
      (p_version->>'sending_hold')::boolean, p_version->>'notes', request, result, p_calendar);
  insert into bridge.invoice_version_weekday_lines
    (version_id, weekday, catalog_item_id, catalog_version, item_name,
      case_quantity, case_price_minor, catalog_snapshot)
    select new_version, (value->>'weekday')::integer, value->>'catalog_item_id',
      value->>'catalog_version', value->>'name', (value->>'case_quantity')::integer,
      (value->>'case_price_minor')::bigint, value->'catalog_snapshot'
    from jsonb_array_elements(p_version->'lines');
  update bridge.invoice_standing_orders set revision = current_order.revision + 1
    where order_id = current_order.order_id;
  return result;
end;
$$;

create function bridge.invoice_calendar_snapshot_v1(p_environment text, p_merchant_id text, p_location_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  document jsonb;
  missing_metadata boolean;
begin
  if p_environment is null or p_environment not in ('dev', 'prod')
    or p_merchant_id is null or length(btrim(p_merchant_id)) not between 1 and 128
    or p_location_id is null or length(btrim(p_location_id)) not between 1 and 128 then
    raise exception 'invoice_invalid_scope' using errcode = '22023';
  end if;
  -- One statement snapshot: head, every immutable revision, and weekdays agree.
  with scoped as (
    select * from bridge.invoice_standing_orders o where o.environment = p_environment
      and o.merchant_id = p_merchant_id and o.location_id = p_location_id
  ), orders as (
    select o.order_id, o.client_id, o.revision, v.items, v.missing,
      (v.items->-1)->>'customer_name' as customer_name
    from scoped o cross join lateral (
      select jsonb_agg(jsonb_build_object(
        'revision', r.revision, 'effective_from', to_char(r.effective_from, 'YYYY-MM-DD'),
        'state', case when (r.calendar_metadata->>'discontinued')::boolean then 'discontinued'
          when r.paused then 'paused' else 'active' end,
        'fulfillment', r.calendar_metadata->>'fulfillment', 'sending_hold', r.sending_hold,
        'customer_name', r.calendar_metadata->>'customer_name',
        'weekdays', (select coalesce(jsonb_agg(w.weekday order by w.weekday), '[]'::jsonb)
          from (select distinct l.weekday from bridge.invoice_version_weekday_lines l
            where l.version_id = r.version_id and l.case_quantity > 0) w)
      ) order by r.revision) as items,
      coalesce(bool_or(r.calendar_metadata is null), true) or count(*) <> o.revision as missing
      from bridge.invoice_standing_order_versions r where r.order_id = o.order_id
    ) v
  )
  select jsonb_build_object('schema', 1, 'complete', true,
    'scope', jsonb_build_object('environment', p_environment, 'merchant_id', p_merchant_id, 'location_id', p_location_id),
    'snapshot_revision', coalesce(sum(o.revision), 0) + 1,
    'as_of', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'orders', coalesce(jsonb_agg(jsonb_build_object('order_id', o.order_id, 'customer_id', o.client_id,
      'customer_name', o.customer_name, 'revisions', o.items) order by o.order_id), '[]'::jsonb)
  ), coalesce(bool_or(o.missing), false) into document, missing_metadata from orders o;
  if missing_metadata then
    raise exception 'invoice_calendar_metadata_missing' using errcode = '22023';
  end if;
  return document;
end;
$$;

revoke all on function bridge.invoice_calendar_version_guard_v1(),
  bridge.invoice_save_standing_order_v2(uuid, integer, jsonb, jsonb, jsonb),
  bridge.invoice_calendar_snapshot_v1(text, text, text)
  from public, anon, authenticated, service_role;
-- Runtime EXECUTE grants are deferred.

-- No new roles, table grants, exposed schemas, real rows, jobs, or enabled sending.

-- Immediate bootstrap verification, run as the same approved object owner.
-- Catalog/data reads only; failures abort the caller's transaction.
do $$
declare
  expected_tables text[] := array['invoice_policy_versions', 'invoice_standing_order_versions',
    'invoice_standing_orders', 'invoice_version_weekday_lines', 'invoice_weekly_snapshot_lines',
    'invoice_weekly_snapshots', 'invoice_weeks'];
  actual_tables text[];
  expected_functions text[] := array[
    'bridge.invoice_validate_standing_order_v1(jsonb,jsonb)',
    'bridge.invoice_save_standing_order_v1(uuid,integer,jsonb,jsonb)',
    'bridge.invoice_preview_week_v1(uuid,date)',
    'bridge.invoice_calendar_version_guard_v1()',
    'bridge.invoice_save_standing_order_v2(uuid,integer,jsonb,jsonb,jsonb)',
    'bridge.invoice_calendar_snapshot_v1(text,text,text)'];
begin
  select array_agg(c.relname::text order by c.relname) into actual_tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'bridge' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S');
  if actual_tables is distinct from expected_tables then
    raise exception 'invoice_bootstrap_unexpected_relation_inventory';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge') <> 6
    or exists (select 1 from unnest(expected_functions) f where to_regprocedure(f) is null) then
    raise exception 'invoice_bootstrap_unexpected_routine_inventory';
  end if;
  if exists (select 1 from pg_roles where rolname = 'svc_wholesale_invoicing') then
    raise exception 'invoice_bootstrap_runtime_role_must_remain_deferred';
  end if;
  if exists (select 1 from pg_namespace n where n.nspname = 'bridge'
      and n.nspowner <> current_user::regrole::oid)
    or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'bridge' and c.relowner <> current_user::regrole::oid)
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge' and p.proowner <> current_user::regrole::oid) then
    raise exception 'invoice_bootstrap_unexpected_object_owner';
  end if;
  if exists (select 1 from pg_namespace n,
      lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
      where n.nspname = 'bridge' and a.grantee <> n.nspowner)
    or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace,
      lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where n.nspname = 'bridge' and c.relkind = 'r' and a.grantee <> c.relowner)
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'bridge' and a.grantee <> p.proowner)
    or exists (select 1 from pg_attribute t join pg_class c on c.oid = t.attrelid
      join pg_namespace n on n.oid = c.relnamespace, lateral aclexplode(t.attacl) a
      where n.nspname = 'bridge' and a.grantee <> c.relowner) then
    raise exception 'invoice_bootstrap_unexpected_delegated_access';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'bridge' and c.relkind = 'r' and not c.relrowsecurity)
    or exists (select 1 from pg_policies where schemaname = 'bridge') then
    raise exception 'invoice_bootstrap_unexpected_rls';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge' and p.proconfig is distinct from array['search_path=""'])
    or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge' and p.prosecdef) <> 4 then
    raise exception 'invoice_bootstrap_unexpected_routine_security';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'bridge'
      and table_name = 'invoice_standing_order_versions' and column_name = 'calendar_metadata'
      and data_type = 'jsonb' and is_nullable = 'YES')
    or (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'bridge' and not t.tgisinternal) <> 1
    or not exists (select 1 from pg_trigger where tgname = 'invoice_calendar_version_guard'
      and tgrelid = 'bridge.invoice_standing_order_versions'::regclass
      and tgfoid = 'bridge.invoice_calendar_version_guard_v1()'::regprocedure
      and tgenabled = 'O' and tgtype = 31) then
    raise exception 'invoice_bootstrap_calendar_contract_missing';
  end if;
  if (select count(*) from bridge.invoice_policy_versions) <> 1
    or not exists (select 1 from bridge.invoice_policy_versions where policy_version = 1
      and enabled = false and timezone = 'America/New_York' and basis = 'standing_order' and tax_exempt)
    or exists (select 1 from bridge.invoice_standing_orders)
    or exists (select 1 from bridge.invoice_standing_order_versions)
    or exists (select 1 from bridge.invoice_version_weekday_lines)
    or exists (select 1 from bridge.invoice_weeks)
    or exists (select 1 from bridge.invoice_weekly_snapshots)
    or exists (select 1 from bridge.invoice_weekly_snapshot_lines) then
    raise exception 'invoice_bootstrap_unexpected_business_rows_or_policy';
  end if;
end;
$$;

select 'owner_only_bootstrap_verified' as result, 7 as tables, 6 as routines,
  1 as revision_guard, false as runtime_access_granted, false as sending_enabled;
