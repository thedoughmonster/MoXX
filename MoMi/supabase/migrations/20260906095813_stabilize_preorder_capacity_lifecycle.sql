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
begin
  if pg_trigger_depth() > 1 then return new; end if;
  insert into momi_preorder.fulfillment_capacity (
    surface_id, fulfillment_date, held_quantity, committed_quantity
  ) values (new.surface_id, new.fulfillment_date, 0, 0)
  on conflict (surface_id, fulfillment_date) do nothing;
  select * into v_capacity from momi_preorder.fulfillment_capacity
    where surface_id = new.surface_id
      and fulfillment_date = new.fulfillment_date for update;
  if tg_op = 'UPDATE' then
    update momi_preorder.fulfillment_capacity set
      held_quantity = held_quantity + new.held_quantity - old.held_quantity,
      committed_quantity = committed_quantity + new.committed_quantity
        - old.committed_quantity,
      updated_at = clock_timestamp()
    where surface_id = new.surface_id
      and fulfillment_date = new.fulfillment_date
    returning * into v_capacity;
  end if;
  new.held_quantity := v_capacity.held_quantity;
  new.committed_quantity := v_capacity.committed_quantity;
  return new;
end;
$$;

create function momi_preorder.propagate_physical_capacity_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  update momi_preorder.fulfillment_windows set
    held_quantity = new.held_quantity,
    committed_quantity = new.committed_quantity
  where surface_id = new.surface_id
    and fulfillment_date = new.fulfillment_date
    and window_id <> new.window_id;
  return new;
end;
$$;

update momi_preorder.fulfillment_windows w set
  held_quantity = c.held_quantity,
  committed_quantity = c.committed_quantity
from momi_preorder.fulfillment_capacity c
where c.surface_id = w.surface_id
  and c.fulfillment_date = w.fulfillment_date;

create trigger sync_physical_capacity_v1
before insert or update of held_quantity, committed_quantity
on momi_preorder.fulfillment_windows for each row
execute function momi_preorder.sync_physical_capacity_v1();
create trigger propagate_physical_capacity_v1
after insert or update of held_quantity, committed_quantity
on momi_preorder.fulfillment_windows for each row
execute function momi_preorder.propagate_physical_capacity_v1();

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
          and attempt.payment_status in ('pending', 'authorized',
            'indeterminate', 'refund_pending'))
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
  'Expires 30-minute unpaid preorder allocations only after durable payment state is terminal or no payment attempt exists; replay is idempotent.';
