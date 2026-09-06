-- service-owner: preorder-operations

create table momi_preorder.fulfillment_capacity (
  surface_id uuid not null references momi_preorder.surfaces(surface_id),
  fulfillment_date date not null,
  held_quantity integer not null default 0 check (held_quantity >= 0),
  committed_quantity integer not null default 0 check (committed_quantity >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (surface_id, fulfillment_date)
);

alter table momi_preorder.fulfillment_capacity enable row level security;
revoke all on momi_preorder.fulfillment_capacity
  from public, anon, authenticated, service_role;

insert into momi_preorder.fulfillment_capacity (
  surface_id, fulfillment_date, held_quantity, committed_quantity
)
select w.surface_id, w.fulfillment_date,
  coalesce((select sum(h.held_quantity)::integer
    from momi_preorder.checkout_holds h
    join momi_preorder.fulfillment_windows hw
      on hw.window_id = h.fulfillment_window_id
    where hw.surface_id = w.surface_id
      and hw.fulfillment_date = w.fulfillment_date
      and h.hold_status = 'active'), 0),
  coalesce((select sum(o.requested_quantity)::integer
    from momi_preorder.orders o
    join momi_preorder.fulfillment_windows ow
      on ow.window_id = o.fulfillment_window_id
    where ow.surface_id = w.surface_id
      and ow.fulfillment_date = w.fulfillment_date
      and o.order_status not in ('canceled', 'expired')), 0)
from momi_preorder.fulfillment_windows w
group by w.surface_id, w.fulfillment_date;

create function momi_preorder.sync_physical_capacity_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_capacity momi_preorder.fulfillment_capacity%rowtype;
  v_surface momi_preorder.surfaces%rowtype;
  v_capacity_limit integer;
  v_held_delta integer := case when tg_op = 'UPDATE'
    then new.held_quantity - old.held_quantity else 0 end;
  v_committed_delta integer := case when tg_op = 'UPDATE'
    then new.committed_quantity - old.committed_quantity else 0 end;
begin
  -- Metadata-only upserts must not acquire a physical counter lock.
  if tg_op = 'UPDATE' and v_held_delta = 0 and v_committed_delta = 0 then
    return new;
  end if;
  if v_held_delta + v_committed_delta > 0 then
    select * into v_surface from momi_preorder.surfaces
      where surface_id = new.surface_id for share;
    if v_surface.enabled then
      v_capacity_limit :=
        (v_surface.preorder_policy#>>'{capacity,daily_limit}')::integer;
    end if;
  end if;
  insert into momi_preorder.fulfillment_capacity (
    surface_id, fulfillment_date, held_quantity, committed_quantity
  ) values (new.surface_id, new.fulfillment_date, 0, 0)
  on conflict (surface_id, fulfillment_date) do nothing;
  select * into v_capacity from momi_preorder.fulfillment_capacity
    where surface_id = new.surface_id
      and fulfillment_date = new.fulfillment_date for update;
  if v_held_delta + v_committed_delta > 0 then
    if v_capacity_limit is null or v_capacity.held_quantity
        + v_capacity.committed_quantity + v_held_delta
        + v_committed_delta > v_capacity_limit then
      raise exception using errcode = 'P5701',
        message = 'preorder physical capacity limit exceeded';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    update momi_preorder.fulfillment_capacity set
      held_quantity = held_quantity + v_held_delta,
      committed_quantity = committed_quantity + v_committed_delta,
      updated_at = clock_timestamp()
    where surface_id = new.surface_id
      and fulfillment_date = new.fulfillment_date
    returning * into v_capacity;
  end if;
  return new;
end;
$$;

create trigger sync_physical_capacity_v1
-- AFTER INSERT resolves the window's unique-key conflict before taking the
-- physical-date lock, matching admission and release (window, then capacity).
after insert or update of held_quantity, committed_quantity
on momi_preorder.fulfillment_windows for each row
execute function momi_preorder.sync_physical_capacity_v1();

alter table momi_preorder.orders
  add column capacity_expires_at timestamptz not null
    default (clock_timestamp() + interval '30 minutes'),
  add column capacity_released_at timestamptz,
  add constraint orders_capacity_release_consistent check (
    capacity_released_at is null or order_status in ('expired', 'canceled',
      'attention_required')
  );

create function momi_preorder.expire_abandoned_orders_v1()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_order momi_preorder.orders%rowtype;
  v_count integer := 0;
begin
  for v_order in select * from momi_preorder.orders
    where order_status = 'awaiting_payment'
      and payment_status in ('not_started', 'declined', 'canceled')
      and not exists (select 1 from momi_preorder.payment_attempts attempt
        where attempt.order_id = orders.order_id
          and (attempt.payment_status not in ('declined', 'canceled')
            or attempt.requires_review))
      and capacity_released_at is null
      and capacity_expires_at <= clock_timestamp()
    order by capacity_expires_at limit 100 for update skip locked
  loop
    update momi_preorder.fulfillment_windows set
      committed_quantity = committed_quantity - v_order.requested_quantity
    where window_id = v_order.fulfillment_window_id
      and committed_quantity >= v_order.requested_quantity;
    if not found then
      raise exception 'preorder physical capacity release invariant failed';
    end if;
    update momi_preorder.orders set order_status = 'expired',
      fulfillment_status = 'canceled',
      capacity_released_at = clock_timestamp(),
      order_version = order_version + 1, updated_at = clock_timestamp()
    where order_id = v_order.order_id and capacity_released_at is null;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function momi_preorder.guard_late_payment_after_capacity_release_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.capacity_released_at is not null
      and new.payment_status in ('pending', 'authorized', 'paid',
        'indeterminate', 'refund_pending') then
    new.order_status := 'attention_required';
  end if;
  return new;
end;
$$;

create trigger guard_late_payment_after_capacity_release_v1
before update of payment_status on momi_preorder.orders for each row
execute function momi_preorder.guard_late_payment_after_capacity_release_v1();

revoke all on function momi_preorder.expire_abandoned_orders_v1()
  from public, anon, authenticated, service_role;
grant execute on function momi_preorder.expire_abandoned_orders_v1()
  to service_role;

select cron.schedule(
  'momi-preorder-abandoned-order-expiry-v1',
  '* * * * *',
  $job$select momi_preorder.expire_abandoned_orders_v1()$job$
);

comment on function momi_preorder.expire_abandoned_orders_v1() is
  'Expires 30-minute unpaid preorder allocations only when every payment attempt is authoritatively declined or canceled, or no attempt exists; replay is idempotent.';

-- Preserve the existing window lifecycle as explicit private definitions.
-- This keeps routine ownership/body inventory replayable without renames.
create function momi_preorder.read_bootstrap_window_capacity_v1(
  p_surface_key text, p_fulfillment_date date default null
) returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'surface_id', s.surface_id, 'surface_key', s.surface_key,
    'location_id', s.location_id, 'location_name', s.location_name,
    'timezone', s.timezone,
    'versions', jsonb_build_object('surface_version', s.surface_version,
      'catalog_version', s.catalog_version, 'policy_version', s.policy_version,
      'mapping_version', s.mapping_version),
    'fulfillment_windows', coalesce((select jsonb_agg(jsonb_build_object(
      'window_id', w.window_id,
      'date', to_char(w.fulfillment_date, 'YYYY-MM-DD'),
      'starts_at', w.starts_at, 'ends_at', w.ends_at,
      'order_cutoff_at', w.order_cutoff_at,
      'availability', case
        when not w.enabled or now() >= w.order_cutoff_at then 'closed'
        when w.held_quantity + w.committed_quantity >= w.capacity_limit
          then 'sold_out'
        when w.capacity_limit - w.held_quantity - w.committed_quantity <=
          w.limited_threshold then 'limited'
        else 'available' end) order by w.starts_at)
      from momi_preorder.fulfillment_windows w
      where w.surface_id = s.surface_id
        and w.policy_version = s.policy_version
        and ((p_fulfillment_date is not null
          and w.fulfillment_date = p_fulfillment_date)
          or (p_fulfillment_date is null and w.fulfillment_date between
            (now() at time zone s.timezone)::date and
            (now() at time zone s.timezone)::date + 30))), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object(
      'item_id', i.item_id, 'item_version', i.item_version,
      'category', i.category_key, 'name', i.name,
      'description', i.description,
      'base_price', jsonb_build_object('currency', i.currency,
        'amount_minor', i.base_price_minor),
      'shop_price', case when i.shop_price_minor is null then null else
        jsonb_build_object('currency', i.currency,
          'amount_minor', i.shop_price_minor) end,
      'price_floor', case when i.price_floor_minor is null then null else
        jsonb_build_object('currency', i.currency,
          'amount_minor', i.price_floor_minor) end,
      'media', i.media, 'allergens', i.allergens,
      'allergen_status', i.allergen_status,
      'seasonal_eligibility', i.seasonal_eligibility,
      'available', i.available and momi_preorder.item_eligible_on_v1(
        i.preorder_enabled, i.eligibility_mode, i.eligible_from_date,
        i.eligible_through_date, p_fulfillment_date),
      'maximum_quantity', i.maximum_quantity,
      'option_groups', i.option_groups, 'disclosures', i.disclosures)
      order by i.category_key, i.name, i.item_id)
      from momi_preorder.catalog_items i
      where i.surface_id = s.surface_id
        and i.catalog_version = s.catalog_version), '[]'::jsonb),
    'cancellation_policy', s.cancellation_policy,
    'fresh_at', now(),
    'expires_at', now() + make_interval(secs => s.freshness_seconds))
  from momi_preorder.surfaces s
  where s.surface_key = p_surface_key and s.enabled
$$;
create function momi_preorder.create_quote_window_capacity_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $quote$
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
    pg_catalog.hashtext(
      'momi_preorder.create_quote_v1:' || v_command_id::text));
  v_existing := null;
  for v_existing in select * from momi_preorder.quotes
    where command_id = v_command_id loop exit; end loop;
  if v_existing.command_id is not null then
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
  v_surface := null;
  for v_surface in select * from momi_preorder.surfaces
    where surface_id = v_surface_id and enabled for share loop exit; end loop;
  if v_surface.surface_id is null then
    return momi_preorder.quote_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'refresh');
  end if;
  if (p_request->'versions'->>'surface_version')::integer <>
      v_surface.surface_version
      or (p_request->'versions'->>'catalog_version')::integer <>
        v_surface.catalog_version
      or (p_request->'versions'->>'policy_version')::integer <>
        v_surface.policy_version
      or (p_request->'versions'->>'mapping_version')::integer <>
        v_surface.mapping_version then
    return momi_preorder.quote_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'refresh');
  end if;
  perform momi_preorder.ensure_fulfillment_windows_v1(v_surface.surface_id);
  v_window := null;
  for v_window in select * from momi_preorder.fulfillment_windows
    where window_id = v_window_id and surface_id = v_surface.surface_id
      and policy_version = v_surface.policy_version
    for share loop exit; end loop;
  if v_window.window_id is null or not v_window.enabled
      or clock_timestamp() >= v_window.order_cutoff_at
      or v_window.fulfillment_date <
        (clock_timestamp() at time zone v_surface.timezone)::date
      or v_window.fulfillment_date >
        (clock_timestamp() at time zone v_surface.timezone)::date + 13 then
    return momi_preorder.quote_failure_v1('conflict', 'window_closed',
      'That pickup window is closed.', true, 'choose_another_window');
  end if;
  v_total_quantity := (select coalesce(
    sum((line->>'quantity')::integer), 0)
    from jsonb_array_elements(p_request->'lines') line);
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
    return momi_preorder.quote_failure_v1('conflict',
      'capacity_unavailable',
      'That pickup window no longer has enough capacity.', true,
      'choose_another_window');
  end if;
  for v_quantity_discount, v_quantity_label, v_current_threshold in
    select coalesce((level->>'discount_bps')::integer, 0), level->>'label',
      (level->>'minimum_quantity')::integer
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'quantity_levels') level
    where (level->>'minimum_quantity')::integer <= v_total_quantity
    order by (level->>'minimum_quantity')::integer desc limit 1
  loop exit; end loop;
  v_quantity_discount := coalesce(v_quantity_discount, 0);
  v_quantity_label := coalesce(v_quantity_label, 'Base');
  v_current_threshold := coalesce(v_current_threshold, 0);
  for v_next_label, v_next_threshold in
    select level->>'label', (level->>'minimum_quantity')::integer
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'quantity_levels') level
    where (level->>'minimum_quantity')::integer > v_total_quantity
    order by (level->>'minimum_quantity')::integer limit 1
  loop exit; end loop;
  for v_notice_discount in
    select coalesce((tier->>'multiplier_bps')::integer, 0)
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'advance_tiers') tier
    where (tier->>'minimum_days')::integer <= v_window.fulfillment_date -
      (clock_timestamp() at time zone v_surface.timezone)::date
    order by (tier->>'minimum_days')::integer desc limit 1
  loop exit; end loop;
  v_notice_discount := coalesce(v_notice_discount, 0);
  for v_line in select value
    from jsonb_array_elements(p_request->'lines') loop
    v_quantity := (v_line->>'quantity')::integer;
    v_item := null;
    for v_item in select * from momi_preorder.catalog_items
      where surface_id = v_surface.surface_id
        and catalog_version = v_surface.catalog_version
        and item_id = (v_line->>'item_id')::uuid loop exit; end loop;
    if v_item.item_id is null or not v_item.available
        or not momi_preorder.item_eligible_on_v1(
          v_item.preorder_enabled, v_item.eligibility_mode,
          v_item.eligible_from_date, v_item.eligible_through_date,
          v_window.fulfillment_date)
        or v_item.seasonal_eligibility <> 'eligible'
        or v_item.item_version <> (v_line->>'item_version')::integer
        or v_quantity > v_item.maximum_quantity then
      return momi_preorder.quote_failure_v1('rejected', 'item_unavailable',
        'A selected item is no longer available.', true,
        'choose_another_item');
    end if;
    if jsonb_array_length(p_request->'avoided_allergens') > 0
        and (v_item.allergen_status in (
          'unverified', 'cross_contact_possible')
          or v_item.allergens ?| array(select jsonb_array_elements_text(
            p_request->'avoided_allergens'))) then
      return momi_preorder.quote_failure_v1('rejected',
        'allergen_unverified',
        'A selected item conflicts with the allergen choices.', false,
        'choose_another_item');
    end if;
    v_quantity_unit := greatest(v_item.price_floor_minor,
      floor(v_item.base_price_minor *
        (10000 - v_quantity_discount) / 10000.0));
    v_final_unit := greatest(v_item.price_floor_minor,
      floor(v_quantity_unit * (10000 - v_notice_discount) / 10000.0));
    if v_final_unit > v_item.shop_price_minor then
      return momi_preorder.quote_failure_v1('rejected', 'item_unavailable',
        'A selected item has no valid preorder price.', false,
        'contact_shop');
    end if;
    v_line_subtotal := v_line_subtotal +
      v_item.base_price_minor * v_quantity;
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
    'total', jsonb_build_object('currency', 'USD',
      'amount_minor', v_final_total),
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
$quote$;
create function momi_preorder.manage_checkout_hold_window_capacity_v1(
  p_request jsonb, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_quote_id uuid := (p_request->>'quote_id')::uuid;
  v_hold_id uuid := nullif(p_request->>'hold_id', '')::uuid;
  v_action text := p_request->>'action';
  v_existing momi_preorder.commands%rowtype;
  v_quote momi_preorder.quotes%rowtype;
  v_hold momi_preorder.checkout_holds%rowtype;
  v_surface momi_preorder.surfaces%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_command_found boolean := false;
  v_request_digest text := momi_preorder.request_digest_v1(p_request);
  v_quantity integer;
  v_response jsonb;
begin
  if p_authority is null or length(p_authority) < 32 then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Checkout authority is invalid.', false, 'requote');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.command:' || v_command_id::text));
  select * into v_existing from momi_preorder.commands
    where command_id = v_command_id;
  v_command_found := found;
  select * into v_quote from momi_preorder.quotes
    where quote_id = v_quote_id for update;
  if not found or v_quote.response_snapshot#>>'{quote,revalidation_token}'
      is distinct from p_authority then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Checkout authority is invalid.', false, 'requote');
  end if;
  if v_command_found then
    if v_existing.contract_key <> 'momi.preorder.checkout_hold.manage.v1'
        or v_existing.request_digest <> v_request_digest then
      return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
        'This command was already used for different data.', false, 'refresh');
    end if;
    return v_existing.response_snapshot;
  end if;
  perform momi_preorder.expire_checkout_holds_v1();
  if (p_request->>'expected_quote_version')::integer <>
      coalesce((v_quote.response_snapshot#>>'{quote,quote_version}')::integer, 0)
  then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'The quote version changed.', true, 'requote');
  end if;
  if v_action = 'create' then
    if clock_timestamp() >= v_quote.expires_at then
      return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
        'The quote expired.', true, 'requote');
    end if;
    select * into v_surface from momi_preorder.surfaces
      where surface_id = v_quote.surface_id;
    if not found or not v_surface.enabled
        or v_surface.surface_version <> v_quote.surface_version
        or v_surface.catalog_version <> v_quote.catalog_version
        or v_surface.policy_version <> v_quote.policy_version
        or v_surface.mapping_version <> v_quote.mapping_version then
      return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
        'The preorder configuration changed.', true, 'requote');
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_quote.request_snapshot->'lines') line
      left join momi_preorder.catalog_items item
        on item.surface_id = v_quote.surface_id
        and item.catalog_version = v_quote.catalog_version
        and item.item_id = (line->>'item_id')::uuid
      where item.item_id is null or not item.available
        or item.seasonal_eligibility <> 'eligible'
        or item.item_version <> (line->>'item_version')::integer
        or (line->>'quantity')::integer > item.maximum_quantity
    ) then
      return momi_preorder.lifecycle_failure_v1('rejected', 'item_unavailable',
        'A selected item is no longer available.', true, 'requote');
    end if;
    if jsonb_array_length(v_quote.request_snapshot->'avoided_allergens') > 0
        and exists (
      select 1 from jsonb_array_elements(v_quote.request_snapshot->'lines') line
      join momi_preorder.catalog_items item
        on item.surface_id = v_quote.surface_id
        and item.catalog_version = v_quote.catalog_version
        and item.item_id = (line->>'item_id')::uuid
      where item.allergen_status in ('unverified', 'cross_contact_possible')
        or item.allergens ?| array(select jsonb_array_elements_text(
          v_quote.request_snapshot->'avoided_allergens'))
    ) then
      return momi_preorder.lifecycle_failure_v1('rejected',
        'allergen_unverified',
        'Allergen evidence changed after quoting.', false, 'requote');
    end if;
    select coalesce(sum((line->>'quantity')::integer), 0) into v_quantity
      from jsonb_array_elements(v_quote.request_snapshot->'lines') line;
    select * into v_window from momi_preorder.fulfillment_windows
      where window_id = v_quote.fulfillment_window_id for update;
    if not found or not v_window.enabled
        or clock_timestamp() >= v_window.order_cutoff_at then
      return momi_preorder.lifecycle_failure_v1('conflict', 'window_closed',
        'That pickup window is closed.', true, 'choose_another_window');
    end if;
    if v_window.capacity_limit - v_window.held_quantity -
        v_window.committed_quantity < v_quantity then
      return momi_preorder.lifecycle_failure_v1('conflict',
        'capacity_unavailable', 'That pickup window is full.', true,
        'choose_another_window');
    end if;
    select * into v_hold from momi_preorder.checkout_holds
      where quote_id = v_quote.quote_id;
    if not found then
      insert into momi_preorder.checkout_holds (
        quote_id, fulfillment_window_id, hold_status, held_quantity, expires_at
      ) values (v_quote.quote_id, v_quote.fulfillment_window_id, 'active',
        v_quantity, v_quote.expires_at) returning * into v_hold;
      update momi_preorder.fulfillment_windows set
        held_quantity = held_quantity + v_quantity
        where window_id = v_quote.fulfillment_window_id;
    elsif v_hold.hold_status <> 'active' then
      return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
        'The checkout hold is no longer active.', true, 'requote');
    end if;
  else
    select * into v_hold from momi_preorder.checkout_holds
      where hold_id = v_hold_id and quote_id = v_quote.quote_id for update;
    if not found then
      return momi_preorder.lifecycle_failure_v1('rejected', 'not_found',
        'The checkout hold was not found.', false, 'requote');
    end if;
    if v_hold.hold_status = 'consumed' then
      return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
        'The checkout hold was already committed to an order.', false,
        'refresh');
    end if;
    if v_action in ('release', 'expire') and v_hold.hold_status = 'active' then
      if v_action = 'expire' and v_hold.expires_at > clock_timestamp() then
        return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
          'The checkout hold has not expired.', false, 'refresh');
      end if;
      update momi_preorder.fulfillment_windows set held_quantity =
        held_quantity - v_hold.held_quantity
        where window_id = v_hold.fulfillment_window_id;
      update momi_preorder.checkout_holds set
        hold_status = case when v_action = 'expire' then 'expired'
          else 'released' end,
        released_at = clock_timestamp(), updated_at = clock_timestamp(),
        hold_version = hold_version + 1 where hold_id = v_hold.hold_id
        returning * into v_hold;
    end if;
  end if;
  v_response := jsonb_build_object('outcome', 'accepted',
    'hold_id', v_hold.hold_id, 'hold_version', v_hold.hold_version,
    'hold_status', v_hold.hold_status, 'expires_at', v_hold.expires_at);
  insert into momi_preorder.commands (
    command_id, contract_key, request_digest, response_snapshot
  ) values (v_command_id, 'momi.preorder.checkout_hold.manage.v1',
    v_request_digest, v_response);
  return v_response;
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
    'The hold request is invalid.', false, 'none');
end;
$$;
create function momi_preorder.create_order_intent_window_capacity_v1(
  p_request jsonb, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_quote_id uuid := (p_request->>'quote_id')::uuid;
  v_hold_id uuid := nullif(p_request->>'hold_id', '')::uuid;
  v_existing momi_preorder.commands%rowtype;
  v_quote momi_preorder.quotes%rowtype;
  v_hold momi_preorder.checkout_holds%rowtype;
  v_order momi_preorder.orders%rowtype;
  v_surface momi_preorder.surfaces%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_command_found boolean := false;
  v_request_digest text := momi_preorder.request_digest_v1(p_request);
  v_order_id uuid := gen_random_uuid();
  v_quantity integer;
  v_token text;
  v_response jsonb;
begin
  if p_authority is null or length(p_authority) < 32 then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Checkout authority is invalid.', false, 'requote');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.command:' || v_command_id::text));
  select * into v_existing from momi_preorder.commands
    where command_id = v_command_id;
  v_command_found := found;
  select * into v_quote from momi_preorder.quotes
    where quote_id = v_quote_id for update;
  if not found or v_quote.response_snapshot#>>'{quote,revalidation_token}'
      is distinct from p_authority then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Checkout authority is invalid.', false, 'requote');
  end if;
  if v_command_found then
    if v_existing.contract_key <> 'momi.preorder.order_intent.create.v1'
        or v_existing.request_digest <> v_request_digest then
      return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
        'This command was already used for different data.', false, 'refresh');
    end if;
    v_token := momi_preorder.recovery_authority_v1(
      p_authority, (v_existing.response_snapshot->>'order_id')::uuid);
    return v_existing.response_snapshot ||
      jsonb_build_object('recovery_authority', v_token);
  end if;
  perform momi_preorder.expire_checkout_holds_v1();
  if (p_request->>'expected_quote_version')::integer <>
      coalesce((v_quote.response_snapshot#>>'{quote,quote_version}')::integer, 0)
      or clock_timestamp() >= v_quote.expires_at then
    return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
      'The quote expired or changed.', true, 'requote');
  end if;
  select * into v_surface from momi_preorder.surfaces
    where surface_id = v_quote.surface_id;
  if not found or not v_surface.enabled
      or v_surface.surface_version <> v_quote.surface_version
      or v_surface.catalog_version <> v_quote.catalog_version
      or v_surface.policy_version <> v_quote.policy_version
      or v_surface.mapping_version <> v_quote.mapping_version then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'requote');
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_quote.request_snapshot->'lines') line
    left join momi_preorder.catalog_items item
      on item.surface_id = v_quote.surface_id
      and item.catalog_version = v_quote.catalog_version
      and item.item_id = (line->>'item_id')::uuid
    where item.item_id is null or not item.available
      or item.seasonal_eligibility <> 'eligible'
      or item.item_version <> (line->>'item_version')::integer
      or (line->>'quantity')::integer > item.maximum_quantity
  ) then
    return momi_preorder.lifecycle_failure_v1('rejected', 'item_unavailable',
      'A selected item is no longer available.', true, 'requote');
  end if;
  if jsonb_array_length(v_quote.request_snapshot->'avoided_allergens') > 0
      and exists (
    select 1 from jsonb_array_elements(v_quote.request_snapshot->'lines') line
    join momi_preorder.catalog_items item
      on item.surface_id = v_quote.surface_id
      and item.catalog_version = v_quote.catalog_version
      and item.item_id = (line->>'item_id')::uuid
    where item.allergen_status in ('unverified', 'cross_contact_possible')
      or item.allergens ?| array(select jsonb_array_elements_text(
        v_quote.request_snapshot->'avoided_allergens'))
  ) then
    return momi_preorder.lifecycle_failure_v1('rejected',
      'allergen_unverified',
      'Allergen evidence changed after quoting.', false, 'requote');
  end if;
  if jsonb_typeof(p_request->'contact') <> 'object'
      or length(trim(p_request->'contact'->>'name')) not between 1 and 120
      or (nullif(trim(p_request->'contact'->>'email'), '') is null
        and nullif(trim(p_request->'contact'->>'phone'), '') is null) then
    return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
      'Customer contact information is incomplete.', false, 'none');
  end if;
  if exists (select 1 from momi_preorder.orders
    where quote_id = v_quote_id) then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'This quote already created an order.', false, 'refresh');
  end if;
  select coalesce(sum((line->>'quantity')::integer), 0) into v_quantity
    from jsonb_array_elements(v_quote.request_snapshot->'lines') line;
  if v_hold_id is not null then
    select * into v_hold from momi_preorder.checkout_holds
      where hold_id = v_hold_id and quote_id = v_quote.quote_id for update;
    if not found or v_hold.hold_status <> 'active'
        or v_hold.expires_at <= clock_timestamp() then
      return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
        'The checkout hold is no longer active.', true, 'requote');
    end if;
    select * into v_window from momi_preorder.fulfillment_windows
      where window_id = v_quote.fulfillment_window_id for update;
  else
    select * into v_window from momi_preorder.fulfillment_windows
      where window_id = v_quote.fulfillment_window_id for update;
  end if;
  if not found or not v_window.enabled
      or clock_timestamp() >= v_window.order_cutoff_at then
    return momi_preorder.lifecycle_failure_v1('conflict', 'window_closed',
      'That pickup window is closed.', true, 'choose_another_window');
  end if;
  if v_hold_id is not null then
    update momi_preorder.fulfillment_windows set
      held_quantity = held_quantity - v_hold.held_quantity,
      committed_quantity = committed_quantity + v_hold.held_quantity
      where window_id = v_window.window_id;
    update momi_preorder.checkout_holds set hold_status = 'consumed',
      released_at = clock_timestamp(), updated_at = clock_timestamp(),
      hold_version = hold_version + 1 where hold_id = v_hold.hold_id;
  else
    if v_quote.capacity_result = 'hold_required' then
      return momi_preorder.lifecycle_failure_v1('conflict',
        'capacity_unavailable', 'A checkout hold is required.', true,
        'retry_later');
    end if;
    if v_window.capacity_limit - v_window.held_quantity -
        v_window.committed_quantity < v_quantity then
      return momi_preorder.lifecycle_failure_v1('conflict',
        'capacity_unavailable', 'That pickup window is full.', true,
        'choose_another_window');
    end if;
    update momi_preorder.fulfillment_windows set committed_quantity =
      committed_quantity + v_quantity where window_id = v_window.window_id;
  end if;
  v_token := momi_preorder.recovery_authority_v1(p_authority, v_order_id);
  insert into momi_preorder.orders (
    order_id, quote_id, hold_id, fulfillment_window_id, order_status,
    payment_status, fulfillment_status, requested_quantity, total_minor,
    currency, contact, quote_snapshot, policy_snapshot,
    recovery_authority_hash
  ) values (v_order_id, v_quote.quote_id, v_hold_id,
    v_quote.fulfillment_window_id, 'awaiting_payment', 'not_started',
    'not_scheduled', v_quantity, v_quote.total_minor, 'USD',
    p_request->'contact', v_quote.response_snapshot,
    jsonb_build_object(
      'policy_version', v_surface.policy_version,
      'summary', coalesce(v_surface.cancellation_policy->>'summary', ''),
      'customer_cancellation_allowed', coalesce((
        v_surface.cancellation_policy->>
          'customer_cancellation_allowed')::boolean, false),
      'customer_modification_allowed', coalesce((
        v_surface.cancellation_policy->>
          'customer_modification_allowed')::boolean, false)
    ),
    momi_preorder.authority_hash_v1(v_token)) returning * into v_order;
  v_response := jsonb_build_object('outcome', 'accepted',
    'order_id', v_order.order_id, 'order_version', v_order.order_version,
    'order_status', v_order.order_status,
    'amount_due', jsonb_build_object('currency', v_order.currency,
      'amount_minor', v_order.total_minor), 'recovery_authority', v_token);
  insert into momi_preorder.commands (
    command_id, contract_key, request_digest, response_snapshot
  ) values (v_command_id, 'momi.preorder.order_intent.create.v1',
    v_request_digest, v_response - 'recovery_authority');
  return v_response;
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
    'The order request is invalid.', false, 'none');
end;
$$;

create or replace function momi_preorder.read_bootstrap_v1(
  p_surface_key text, p_fulfillment_date date default null
) returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare
  v_result jsonb := momi_preorder.read_bootstrap_window_capacity_v1(
    p_surface_key, p_fulfillment_date);
  v_window jsonb;
  v_windows jsonb := '[]'::jsonb;
  v_availability text;
begin
  for v_window in select value from jsonb_array_elements(
    coalesce(v_result->'fulfillment_windows', '[]'::jsonb)) loop
    select case
      when not w.enabled or now() >= w.order_cutoff_at then 'closed'
      when coalesce(capacity.held_quantity, 0) +
          coalesce(capacity.committed_quantity, 0) >= w.capacity_limit
        then 'sold_out'
      when w.capacity_limit - coalesce(capacity.held_quantity, 0) -
          coalesce(capacity.committed_quantity, 0) <= w.limited_threshold
        then 'limited'
      else 'available' end into v_availability
    from momi_preorder.fulfillment_windows w
    left join momi_preorder.fulfillment_capacity capacity
      on capacity.surface_id = w.surface_id
      and capacity.fulfillment_date = w.fulfillment_date
    where w.window_id = (v_window->>'window_id')::uuid;
    v_windows := v_windows || jsonb_build_array(jsonb_set(
      v_window, '{availability}', to_jsonb(v_availability)));
  end loop;
  return jsonb_set(v_result, '{fulfillment_windows}', v_windows);
end;
$$;

create or replace function momi_preorder.create_quote_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_surface_id uuid := (p_request->>'surface_id')::uuid;
  v_window_id uuid := (p_request->>'fulfillment_window_id')::uuid;
  v_surface momi_preorder.surfaces%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_capacity momi_preorder.fulfillment_capacity%rowtype;
  v_quantity integer;
  v_capacity_result text;
  v_result jsonb;
begin
  if exists (select 1 from momi_preorder.quotes
      where command_id = v_command_id) then
    return momi_preorder.create_quote_window_capacity_v1(p_request);
  end if;
  select * into v_surface from momi_preorder.surfaces
    where surface_id = v_surface_id for share;
  if not found or not v_surface.enabled
      or (p_request->'versions'->>'surface_version')::integer <>
        v_surface.surface_version
      or (p_request->'versions'->>'catalog_version')::integer <>
        v_surface.catalog_version
      or (p_request->'versions'->>'policy_version')::integer <>
        v_surface.policy_version
      or (p_request->'versions'->>'mapping_version')::integer <>
        v_surface.mapping_version then
    return momi_preorder.create_quote_window_capacity_v1(p_request);
  end if;
  perform momi_preorder.ensure_fulfillment_windows_v1(v_surface.surface_id);
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_window_id and surface_id = v_surface.surface_id
      and policy_version = v_surface.policy_version;
  if not found then
    return momi_preorder.create_quote_window_capacity_v1(p_request);
  end if;
  select * into v_capacity from momi_preorder.fulfillment_capacity
    where surface_id = v_surface.surface_id
      and fulfillment_date = v_window.fulfillment_date;
  v_quantity := (select coalesce(sum((line->>'quantity')::integer), 0)
    from jsonb_array_elements(p_request->'lines') line);
  if v_quantity > v_window.capacity_limit -
      coalesce(v_capacity.held_quantity, 0) -
      coalesce(v_capacity.committed_quantity, 0) then
    return momi_preorder.quote_failure_v1('conflict',
      'capacity_unavailable',
      'That pickup window no longer has enough capacity.', true,
      'choose_another_window');
  end if;
  v_capacity_result := case when v_window.capacity_limit -
      coalesce(v_capacity.held_quantity, 0) -
      coalesce(v_capacity.committed_quantity, 0) - v_quantity <=
      v_window.limited_threshold then 'hold_required' else 'available' end;
  v_result := momi_preorder.create_quote_window_capacity_v1(p_request);
  if v_result->>'outcome' = 'accepted' then
    v_result := jsonb_set(v_result, '{quote,capacity_result}',
      to_jsonb(v_capacity_result));
    update momi_preorder.quotes set capacity_result = v_capacity_result,
      response_snapshot = v_result where command_id = v_command_id;
  end if;
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
    'The quote request is invalid.', false, 'none');
end;
$$;

create or replace function momi_preorder.manage_checkout_hold_v1(
  p_request jsonb, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_surface_id uuid;
begin
  if exists (select 1 from momi_preorder.commands
      where command_id = v_command_id) then
    return momi_preorder.manage_checkout_hold_window_capacity_v1(
      p_request, p_authority);
  end if;
  if p_request->>'action' = 'create' then
    select surface_id into v_surface_id from momi_preorder.quotes
      where quote_id = (p_request->>'quote_id')::uuid;
    perform 1 from momi_preorder.surfaces
      where surface_id = v_surface_id for share;
  end if;
  return momi_preorder.manage_checkout_hold_window_capacity_v1(
    p_request, p_authority);
exception when sqlstate 'P5701' then
  return momi_preorder.lifecycle_failure_v1('conflict',
    'capacity_unavailable', 'That pickup window is full.', true,
    'choose_another_window');
when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
    'The hold request is invalid.', false, 'none');
end;
$$;

create or replace function momi_preorder.create_order_intent_v1(
  p_request jsonb, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_surface_id uuid;
begin
  if exists (select 1 from momi_preorder.commands
      where command_id = v_command_id) then
    return momi_preorder.create_order_intent_window_capacity_v1(
      p_request, p_authority);
  end if;
  select surface_id into v_surface_id from momi_preorder.quotes
    where quote_id = (p_request->>'quote_id')::uuid;
  perform 1 from momi_preorder.surfaces
    where surface_id = v_surface_id for share;
  return momi_preorder.create_order_intent_window_capacity_v1(
    p_request, p_authority);
exception when sqlstate 'P5701' then
  return momi_preorder.lifecycle_failure_v1('conflict',
    'capacity_unavailable', 'That pickup window is full.', true,
    'choose_another_window');
when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
    'The order request is invalid.', false, 'none');
end;
$$;

revoke all on function momi_preorder.read_bootstrap_window_capacity_v1(text, date),
  momi_preorder.create_quote_window_capacity_v1(jsonb),
  momi_preorder.manage_checkout_hold_window_capacity_v1(jsonb, text),
  momi_preorder.create_order_intent_window_capacity_v1(jsonb, text),
  momi_preorder.read_bootstrap_v1(text, date),
  momi_preorder.create_quote_v1(jsonb),
  momi_preorder.manage_checkout_hold_v1(jsonb, text),
  momi_preorder.create_order_intent_v1(jsonb, text)
  from public, anon, authenticated, service_role;

grant execute on function momi_preorder.read_bootstrap_v1(text, date),
  momi_preorder.create_quote_v1(jsonb),
  momi_preorder.manage_checkout_hold_v1(jsonb, text),
  momi_preorder.create_order_intent_v1(jsonb, text)
  to service_role;
