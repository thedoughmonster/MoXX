-- service-owner: preorder-operations

alter table momi_preorder.fulfillment_windows
  drop constraint fulfillment_windows_surface_id_fulfillment_date_starts_at_key;
alter table momi_preorder.fulfillment_windows
  add constraint fulfillment_windows_surface_date_key
  unique (surface_id, fulfillment_date);

create table momi_preorder.quotes (
  quote_id uuid primary key default gen_random_uuid(),
  command_id uuid not null unique,
  request_snapshot jsonb not null check (jsonb_typeof(request_snapshot) = 'object'),
  response_snapshot jsonb not null check (jsonb_typeof(response_snapshot) = 'object'),
  surface_id uuid not null references momi_preorder.surfaces(surface_id),
  fulfillment_window_id uuid not null
    references momi_preorder.fulfillment_windows(window_id),
  surface_version integer not null check (surface_version > 0),
  catalog_version integer not null check (catalog_version > 0),
  policy_version integer not null check (policy_version > 0),
  mapping_version integer not null check (mapping_version > 0),
  cart_version integer not null check (cart_version > 0),
  requested_quantity integer not null check (requested_quantity > 0),
  line_subtotal_minor integer not null check (line_subtotal_minor >= 0),
  quantity_savings_minor integer not null check (quantity_savings_minor >= 0),
  notice_savings_minor integer not null check (notice_savings_minor >= 0),
  shop_comparison_minor integer not null check (shop_comparison_minor > 0),
  total_minor integer not null check (
    total_minor >= 0 and total_minor < shop_comparison_minor
  ),
  capacity_result text not null check (
    capacity_result in ('available', 'hold_required')
  ),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (quantity_savings_minor + notice_savings_minor <= line_subtotal_minor)
);

alter table momi_preorder.quotes enable row level security;
revoke all on momi_preorder.quotes from public, anon, authenticated, service_role;

create function momi_preorder.validate_active_savings_policy_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_advance integer[];
  v_quantities integer[];
begin
  if new.publication_mode <> 'active' then return new; end if;
  select array_agg((tier->>'multiplier_bps')::integer order by
      (tier->>'minimum_days')::integer)
    into v_advance
    from jsonb_array_elements(
      new.configuration->'savings_policy'->'advance_tiers') tier;
  if v_advance is null or array_length(v_advance, 1) <> 3
      or exists (select 1 from unnest(v_advance) value
        where value not between 0 and 10000)
      or v_advance[1] > v_advance[2] or v_advance[2] > v_advance[3] then
    raise exception 'advance savings must improve at 2, 5, and 10 days';
  end if;
  select array_agg((level->>'discount_bps')::integer order by
      (level->>'minimum_quantity')::integer)
    into v_quantities
    from jsonb_array_elements(
      new.configuration->'savings_policy'->'quantity_levels') level;
  if v_quantities is null
      or exists (select 1 from unnest(v_quantities) value
        where value not between 0 and 10000)
      or exists (
    select 1 from (
      select (level->>'minimum_quantity')::integer threshold,
        (level->>'discount_bps')::integer discount,
        lag((level->>'discount_bps')::integer) over (
          order by (level->>'minimum_quantity')::integer) prior_discount,
        count(*) over (partition by (level->>'minimum_quantity')::integer) duplicates
      from jsonb_array_elements(
        new.configuration->'savings_policy'->'quantity_levels') level
    ) ordered where duplicates > 1 or discount < prior_discount
  ) then
    raise exception 'quantity savings thresholds must be unique and monotonic';
  end if;
  return new;
end;
$$;

create trigger validate_active_savings_policy_v1
before insert on momi_preorder.configuration_publications
for each row execute function momi_preorder.validate_active_savings_policy_v1();

create function momi_preorder.ensure_fulfillment_windows_v1(p_surface_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_surface momi_preorder.surfaces%rowtype;
  v_pickup jsonb;
  v_capacity jsonb;
  v_today date;
begin
  select * into v_surface from momi_preorder.surfaces
    where surface_id = p_surface_id and enabled;
  if not found then return; end if;
  v_pickup := v_surface.preorder_policy->'pickup';
  v_capacity := v_surface.preorder_policy->'capacity';
  v_today := (clock_timestamp() at time zone v_surface.timezone)::date;
  if v_pickup->>'horizon_days' is distinct from '14'
      or v_pickup->>'cutoff_hours' is null
      or v_capacity->>'daily_limit' is null
      or v_capacity->>'limited_threshold' is null then
    raise exception 'active preorder window policy is incomplete';
  end if;
  insert into momi_preorder.fulfillment_windows (
    surface_id, fulfillment_date, starts_at, ends_at, order_cutoff_at,
    capacity_limit, limited_threshold, enabled
  ) select v_surface.surface_id, day::date,
    (day::date + (v_pickup->>'daily_start_local')::time)
      at time zone v_surface.timezone,
    (day::date + (v_pickup->>'daily_end_local')::time)
      at time zone v_surface.timezone,
    ((day::date + (v_pickup->>'daily_start_local')::time)
      at time zone v_surface.timezone) -
      make_interval(hours => (v_pickup->>'cutoff_hours')::integer),
    (v_capacity->>'daily_limit')::integer,
    (v_capacity->>'limited_threshold')::integer,
    not ((v_pickup->'closures') ? to_char(day::date, 'YYYY-MM-DD'))
  from generate_series(v_today, v_today + 13, interval '1 day') day
  on conflict (surface_id, fulfillment_date) do update set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    order_cutoff_at = excluded.order_cutoff_at,
    capacity_limit = excluded.capacity_limit,
    limited_threshold = excluded.limited_threshold,
    enabled = excluded.enabled;
end;
$$;

create function momi_preorder.refresh_fulfillment_windows_v1(p_surface_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_surface_id uuid;
begin
  select surface_id into v_surface_id from momi_preorder.surfaces
    where surface_key = p_surface_key and enabled;
  if v_surface_id is null then return false; end if;
  perform momi_preorder.ensure_fulfillment_windows_v1(v_surface_id);
  return true;
end;
$$;

create function momi_preorder.refresh_fulfillment_windows_on_surface_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.enabled then
    perform momi_preorder.ensure_fulfillment_windows_v1(new.surface_id);
  end if;
  return new;
end;
$$;

create trigger refresh_fulfillment_windows_on_surface_v1
after insert or update of active_publication_id, preorder_policy, enabled
on momi_preorder.surfaces for each row
execute function momi_preorder.refresh_fulfillment_windows_on_surface_v1();

create function momi_preorder.quote_failure_v1(
  p_outcome text, p_code text, p_message text,
  p_retryable boolean, p_next_action text
) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('outcome', p_outcome, 'error', jsonb_build_object(
    'code', p_code, 'message', p_message,
    'retryable', p_retryable, 'next_action', p_next_action))
$$;

create function momi_preorder.create_quote_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_surface_id uuid := (p_request->>'surface_id')::uuid;
  v_window_id uuid := (p_request->>'fulfillment_window_id')::uuid;
  v_surface momi_preorder.surfaces%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_existing momi_preorder.quotes%rowtype;
  v_line jsonb;
  v_item momi_preorder.catalog_items%rowtype;
  v_quantity integer;
  v_total_quantity integer := 0;
  v_quantity_discount integer := 0;
  v_notice_discount integer := 0;
  v_quantity_label text := 'Base';
  v_current_threshold integer := 0;
  v_next_label text;
  v_next_threshold integer;
  v_line_subtotal integer := 0;
  v_quantity_total integer := 0;
  v_final_total integer := 0;
  v_shop_total integer := 0;
  v_quantity_unit integer;
  v_final_unit integer;
  v_remaining integer;
  v_capacity_result text;
  v_expires_at timestamptz;
  v_quote_id uuid := gen_random_uuid();
  v_token text := replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '');
  v_quote jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.create_quote_v1:' || v_command_id::text));
  select * into v_existing from momi_preorder.quotes
    where command_id = v_command_id;
  if found then
    if v_existing.request_snapshot is distinct from p_request then
      return momi_preorder.quote_failure_v1('conflict', 'stale_version',
        'This quote command was already used for different cart data.',
        false, 'requote');
    end if;
    return v_existing.response_snapshot;
  end if;
  if jsonb_typeof(p_request) <> 'object'
      or jsonb_array_length(p_request->'lines') not between 1 and 50
      or jsonb_typeof(p_request->'avoided_allergens') <> 'array' then
    return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
      'The quote request is invalid.', false, 'none');
  end if;
  select * into v_surface from momi_preorder.surfaces
    where surface_id = v_surface_id and enabled for share;
  if not found then
    return momi_preorder.quote_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'refresh');
  end if;
  if (p_request->'versions'->>'surface_version')::integer <> v_surface.surface_version
      or (p_request->'versions'->>'catalog_version')::integer <> v_surface.catalog_version
      or (p_request->'versions'->>'policy_version')::integer <> v_surface.policy_version
      or (p_request->'versions'->>'mapping_version')::integer <> v_surface.mapping_version then
    return momi_preorder.quote_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'refresh');
  end if;
  perform momi_preorder.ensure_fulfillment_windows_v1(v_surface.surface_id);
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_window_id and surface_id = v_surface.surface_id for share;
  if not found or not v_window.enabled or clock_timestamp() >= v_window.order_cutoff_at
      or v_window.fulfillment_date <
        (clock_timestamp() at time zone v_surface.timezone)::date
      or v_window.fulfillment_date >
        (clock_timestamp() at time zone v_surface.timezone)::date + 13 then
    return momi_preorder.quote_failure_v1('conflict', 'window_closed',
      'That pickup window is closed.', true, 'choose_another_window');
  end if;
  select coalesce(sum((line->>'quantity')::integer), 0)
    into v_total_quantity from jsonb_array_elements(p_request->'lines') line;
  if v_total_quantity < 1 or exists (
    select 1 from jsonb_array_elements(p_request->'lines') line
    where (line->>'quantity')::integer not between 1 and 100
      or jsonb_array_length(line->'choice_ids') > 0
  ) or exists (
    select 1 from jsonb_array_elements(p_request->'lines') line
    group by line->>'line_id' having count(*) > 1
  ) then
    return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
      'The cart contains an unsupported line.', false, 'none');
  end if;
  v_remaining := v_window.capacity_limit - v_window.held_quantity -
    v_window.committed_quantity;
  if v_total_quantity > v_remaining then
    return momi_preorder.quote_failure_v1('conflict', 'capacity_unavailable',
      'That pickup window no longer has enough capacity.', true,
      'choose_another_window');
  end if;
  select coalesce((level->>'discount_bps')::integer, 0), level->>'label',
    (level->>'minimum_quantity')::integer
    into v_quantity_discount, v_quantity_label, v_current_threshold
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'quantity_levels') level
    where (level->>'minimum_quantity')::integer <= v_total_quantity
    order by (level->>'minimum_quantity')::integer desc limit 1;
  v_quantity_discount := coalesce(v_quantity_discount, 0);
  v_quantity_label := coalesce(v_quantity_label, 'Base');
  v_current_threshold := coalesce(v_current_threshold, 0);
  select level->>'label', (level->>'minimum_quantity')::integer
    into v_next_label, v_next_threshold
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'quantity_levels') level
    where (level->>'minimum_quantity')::integer > v_total_quantity
    order by (level->>'minimum_quantity')::integer limit 1;
  select coalesce((tier->>'multiplier_bps')::integer, 0)
    into v_notice_discount
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'advance_tiers') tier
    where (tier->>'minimum_days')::integer <= v_window.fulfillment_date -
      (clock_timestamp() at time zone v_surface.timezone)::date
    order by (tier->>'minimum_days')::integer desc limit 1;
  v_notice_discount := coalesce(v_notice_discount, 0);
  for v_line in select value from jsonb_array_elements(p_request->'lines') loop
    v_quantity := (v_line->>'quantity')::integer;
    select * into v_item from momi_preorder.catalog_items
      where surface_id = v_surface.surface_id
        and catalog_version = v_surface.catalog_version
        and item_id = (v_line->>'item_id')::uuid;
    if not found or not v_item.available
        or v_item.seasonal_eligibility <> 'eligible'
        or v_item.item_version <> (v_line->>'item_version')::integer
        or v_quantity > v_item.maximum_quantity then
      return momi_preorder.quote_failure_v1('rejected', 'item_unavailable',
        'A selected item is no longer available.', true,
        'choose_another_item');
    end if;
    if v_item.allergen_status = 'unverified'
        or (v_item.allergen_status = 'cross_contact_possible'
          and jsonb_array_length(p_request->'avoided_allergens') > 0)
        or v_item.allergens ?| array(select jsonb_array_elements_text(
          p_request->'avoided_allergens')) then
      return momi_preorder.quote_failure_v1('rejected', 'allergen_unverified',
        'A selected item conflicts with the allergen choices.', false,
        'choose_another_item');
    end if;
    v_quantity_unit := greatest(v_item.price_floor_minor,
      floor(v_item.base_price_minor * (10000 - v_quantity_discount) / 10000.0));
    v_final_unit := greatest(v_item.price_floor_minor,
      floor(v_quantity_unit * (10000 - v_notice_discount) / 10000.0));
    if v_final_unit >= v_item.shop_price_minor then
      return momi_preorder.quote_failure_v1('rejected', 'item_unavailable',
        'A selected item has no valid preorder price.', false, 'contact_shop');
    end if;
    v_line_subtotal := v_line_subtotal + v_item.base_price_minor * v_quantity;
    v_quantity_total := v_quantity_total + v_quantity_unit * v_quantity;
    v_final_total := v_final_total + v_final_unit * v_quantity;
    v_shop_total := v_shop_total + v_item.shop_price_minor * v_quantity;
  end loop;
  v_capacity_result := case
    when v_remaining - v_total_quantity <= v_window.limited_threshold
      then 'hold_required' else 'available' end;
  v_expires_at := least(clock_timestamp() + interval '5 minutes',
    v_window.order_cutoff_at);
  v_quote := jsonb_build_object(
    'quote_id', v_quote_id, 'quote_version', 1,
    'fulfillment_window_id', v_window.window_id,
    'line_subtotal', jsonb_build_object('currency', 'USD',
      'amount_minor', v_line_subtotal),
    'quantity_savings', jsonb_build_object('currency', 'USD',
      'amount_minor', v_line_subtotal - v_quantity_total),
    'notice_savings', jsonb_build_object('currency', 'USD',
      'amount_minor', v_quantity_total - v_final_total),
    'fees', jsonb_build_object('currency', 'USD', 'amount_minor', 0),
    'tax', jsonb_build_object('currency', 'USD', 'amount_minor', 0),
    'total', jsonb_build_object('currency', 'USD', 'amount_minor', v_final_total),
    'shop_comparison_total', jsonb_build_object('currency', 'USD',
      'amount_minor', v_shop_total),
    'preorder_savings_total', jsonb_build_object('currency', 'USD',
      'amount_minor', v_shop_total - v_final_total),
    'quantity_progress', jsonb_build_object(
      'current_level', v_quantity_label,
      'current_threshold', v_current_threshold,
      'current_discount_bps', v_quantity_discount,
      'next_level', v_next_label,
      'next_threshold', v_next_threshold,
      'quantity_needed', case when v_next_threshold is null then null
        else v_next_threshold - v_total_quantity end),
    'advance_discount_bps', v_notice_discount,
    'capacity_result', v_capacity_result,
    'versions', jsonb_build_object(
      'surface_version', v_surface.surface_version,
      'catalog_version', v_surface.catalog_version,
      'policy_version', v_surface.policy_version,
      'mapping_version', v_surface.mapping_version),
    'expires_at', v_expires_at, 'revalidation_token', v_token);
  insert into momi_preorder.quotes (
    quote_id, command_id, request_snapshot, response_snapshot, surface_id,
    fulfillment_window_id, surface_version, catalog_version, policy_version,
    mapping_version, cart_version, requested_quantity, line_subtotal_minor,
    quantity_savings_minor, notice_savings_minor, shop_comparison_minor,
    total_minor, capacity_result, expires_at
  ) values (v_quote_id, v_command_id, p_request,
    jsonb_build_object('outcome', 'accepted', 'quote', v_quote),
    v_surface.surface_id, v_window.window_id, v_surface.surface_version,
    v_surface.catalog_version, v_surface.policy_version,
    v_surface.mapping_version, (p_request->>'cart_version')::integer,
    v_total_quantity, v_line_subtotal, v_line_subtotal - v_quantity_total,
    v_quantity_total - v_final_total, v_shop_total, v_final_total,
    v_capacity_result, v_expires_at);
  return jsonb_build_object('outcome', 'accepted', 'quote', v_quote);
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
    'The quote request is invalid.', false, 'none');
end;
$$;

create or replace function momi_preorder.admit_public_read_v1(p_contract_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  admitted boolean;
  bucket timestamptz := date_trunc('minute', clock_timestamp());
begin
  if p_contract_key not in (
    'momi.preorder.bootstrap.read.v1', 'momi.preorder.quote.create.v1'
  ) then return false; end if;
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

revoke all on all functions in schema momi_preorder
  from public, anon, authenticated, service_role;
grant usage on schema momi_preorder to service_role;
grant execute on function momi_preorder.admit_public_read_v1(text)
  to service_role;
grant execute on function momi_preorder.read_bootstrap_v1(text, date)
  to service_role;
grant execute on function momi_preorder.publish_configuration_v1(jsonb, text, text)
  to service_role;
grant execute on function momi_preorder.refresh_fulfillment_windows_v1(text)
  to service_role;
grant execute on function momi_preorder.create_quote_v1(jsonb)
  to service_role;
