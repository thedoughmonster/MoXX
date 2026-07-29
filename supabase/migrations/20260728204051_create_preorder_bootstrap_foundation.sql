-- service-owner: preorder-operations

create schema momi_preorder;
revoke all on schema momi_preorder from public, anon, authenticated, service_role;

create table momi_preorder.surfaces (
  surface_id uuid primary key default gen_random_uuid(),
  surface_key text not null unique
    check (surface_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  location_id uuid not null,
  location_name text not null check (length(location_name) between 1 and 120),
  timezone text not null check (length(timezone) between 1 and 64),
  surface_version integer not null check (surface_version > 0),
  catalog_version integer not null check (catalog_version > 0),
  policy_version integer not null check (policy_version > 0),
  mapping_version integer not null check (mapping_version > 0),
  cancellation_policy jsonb not null
    check (jsonb_typeof(cancellation_policy) = 'object'),
  freshness_seconds integer not null default 300
    check (freshness_seconds between 30 and 3600),
  published_at timestamptz not null default now(),
  enabled boolean not null default false
);

create table momi_preorder.fulfillment_windows (
  window_id uuid primary key default gen_random_uuid(),
  surface_id uuid not null references momi_preorder.surfaces(surface_id),
  fulfillment_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  order_cutoff_at timestamptz not null,
  capacity_limit integer not null check (capacity_limit >= 0),
  held_quantity integer not null default 0 check (held_quantity >= 0),
  committed_quantity integer not null default 0 check (committed_quantity >= 0),
  limited_threshold integer not null default 0 check (limited_threshold >= 0),
  enabled boolean not null default false,
  unique (surface_id, fulfillment_date, starts_at),
  check (starts_at < ends_at),
  check (order_cutoff_at <= starts_at),
  check (held_quantity + committed_quantity <= capacity_limit)
);

create table momi_preorder.catalog_items (
  surface_id uuid not null references momi_preorder.surfaces(surface_id),
  catalog_version integer not null check (catalog_version > 0),
  item_id uuid not null,
  item_version integer not null check (item_version > 0),
  name text not null check (length(name) between 1 and 120),
  description text not null check (length(description) <= 1000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  base_price_minor integer not null check (base_price_minor >= 0),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  allergen_status text not null check (allergen_status in (
    'verified', 'contains_declared', 'cross_contact_possible', 'unverified'
  )),
  seasonal_eligibility text not null check (seasonal_eligibility in (
    'eligible', 'ineligible'
  )),
  available boolean not null default false,
  maximum_quantity integer not null check (maximum_quantity >= 0),
  option_groups jsonb not null default '[]'::jsonb
    check (jsonb_typeof(option_groups) = 'array'),
  disclosures jsonb not null default '[]'::jsonb
    check (jsonb_typeof(disclosures) = 'array'),
  primary key (surface_id, catalog_version, item_id),
  check (not available or allergen_status <> 'unverified')
);

create table momi_preorder.public_read_rate_buckets (
  contract_key text not null,
  bucket_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 600),
  primary key (contract_key, bucket_started_at)
);

alter table momi_preorder.surfaces enable row level security;
alter table momi_preorder.fulfillment_windows enable row level security;
alter table momi_preorder.catalog_items enable row level security;
alter table momi_preorder.public_read_rate_buckets enable row level security;
revoke all on all tables in schema momi_preorder
  from public, anon, authenticated, service_role;

create function momi_preorder.admit_public_read_v1(p_contract_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  admitted boolean;
  bucket timestamptz := date_trunc('minute', clock_timestamp());
begin
  if p_contract_key <> 'momi.preorder.bootstrap.read.v1' then
    return false;
  end if;
  delete from momi_preorder.public_read_rate_buckets
    where bucket_started_at < bucket - interval '10 minutes';
  insert into momi_preorder.public_read_rate_buckets
    (contract_key, bucket_started_at, request_count)
  values (p_contract_key, bucket, 1)
  on conflict (contract_key, bucket_started_at) do update
    set request_count = momi_preorder.public_read_rate_buckets.request_count + 1
    where momi_preorder.public_read_rate_buckets.request_count < 600
  returning true into admitted;
  return coalesce(admitted, false);
end;
$$;

create function momi_preorder.read_bootstrap_v1(
  p_surface_key text, p_fulfillment_date date default null
) returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'surface_id', s.surface_id,
    'surface_key', s.surface_key,
    'location_id', s.location_id,
    'location_name', s.location_name,
    'timezone', s.timezone,
    'versions', jsonb_build_object(
      'surface_version', s.surface_version,
      'catalog_version', s.catalog_version,
      'policy_version', s.policy_version,
      'mapping_version', s.mapping_version
    ),
    'fulfillment_windows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'window_id', w.window_id,
        'date', to_char(w.fulfillment_date, 'YYYY-MM-DD'),
        'starts_at', w.starts_at,
        'ends_at', w.ends_at,
        'order_cutoff_at', w.order_cutoff_at,
        'availability', case
          when not w.enabled or now() >= w.order_cutoff_at then 'closed'
          when w.held_quantity + w.committed_quantity >= w.capacity_limit
            then 'sold_out'
          when w.capacity_limit - w.held_quantity - w.committed_quantity
            <= w.limited_threshold then 'limited'
          else 'available'
        end
      ) order by w.starts_at)
      from momi_preorder.fulfillment_windows w
      where w.surface_id = s.surface_id
        and ((p_fulfillment_date is not null
            and w.fulfillment_date = p_fulfillment_date)
          or (p_fulfillment_date is null
            and w.fulfillment_date between
              (now() at time zone s.timezone)::date
              and (now() at time zone s.timezone)::date + 30))
    ), '[]'::jsonb),
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', i.item_id,
        'item_version', i.item_version,
        'name', i.name,
        'description', i.description,
        'base_price', jsonb_build_object(
          'currency', i.currency, 'amount_minor', i.base_price_minor),
        'media', i.media,
        'allergen_status', i.allergen_status,
        'seasonal_eligibility', i.seasonal_eligibility,
        'available', i.available,
        'maximum_quantity', i.maximum_quantity,
        'option_groups', i.option_groups,
        'disclosures', i.disclosures
      ) order by i.name, i.item_id)
      from momi_preorder.catalog_items i
      where i.surface_id = s.surface_id
        and i.catalog_version = s.catalog_version
    ), '[]'::jsonb),
    'cancellation_policy', s.cancellation_policy,
    'fresh_at', now(),
    'expires_at', now() + make_interval(secs => s.freshness_seconds)
  )
  from momi_preorder.surfaces s
  where s.surface_key = p_surface_key and s.enabled
$$;

revoke all on all functions in schema momi_preorder
  from public, anon, authenticated, service_role;
grant usage on schema momi_preorder to service_role;
grant execute on function momi_preorder.admit_public_read_v1(text)
  to service_role;
grant execute on function momi_preorder.read_bootstrap_v1(text, date)
  to service_role;
