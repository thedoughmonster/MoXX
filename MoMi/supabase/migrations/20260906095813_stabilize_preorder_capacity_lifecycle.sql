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
before insert or update of held_quantity, committed_quantity
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

alter function momi_preorder.read_bootstrap_v1(text, date)
  rename to read_bootstrap_window_capacity_v1;
alter function momi_preorder.create_quote_v1(jsonb)
  rename to create_quote_window_capacity_v1;
alter function momi_preorder.manage_checkout_hold_v1(jsonb, text)
  rename to manage_checkout_hold_window_capacity_v1;
alter function momi_preorder.create_order_intent_v1(jsonb, text)
  rename to create_order_intent_window_capacity_v1;

create function momi_preorder.read_bootstrap_v1(
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

create function momi_preorder.create_quote_v1(p_request jsonb)
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

create function momi_preorder.manage_checkout_hold_v1(
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

create function momi_preorder.create_order_intent_v1(
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
