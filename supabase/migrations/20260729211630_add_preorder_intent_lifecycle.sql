-- service-owner: preorder-operations

create table momi_preorder.commands (
  command_id uuid primary key,
  contract_key text not null,
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  response_snapshot jsonb not null check (jsonb_typeof(response_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  check (contract_key in (
    'momi.preorder.checkout_hold.manage.v1',
    'momi.preorder.order_intent.create.v1'
  ))
);

create table momi_preorder.checkout_holds (
  hold_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references momi_preorder.quotes(quote_id),
  fulfillment_window_id uuid not null
    references momi_preorder.fulfillment_windows(window_id),
  hold_version integer not null default 1 check (hold_version > 0),
  hold_status text not null check (
    hold_status in ('active', 'released', 'expired', 'consumed')
  ),
  held_quantity integer not null check (held_quantity > 0),
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table momi_preorder.orders (
  order_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references momi_preorder.quotes(quote_id),
  hold_id uuid unique references momi_preorder.checkout_holds(hold_id),
  fulfillment_window_id uuid not null
    references momi_preorder.fulfillment_windows(window_id),
  order_version integer not null default 1 check (order_version > 0),
  order_status text not null check (order_status in (
    'awaiting_payment', 'payment_pending', 'confirmed', 'in_production',
    'ready', 'completed', 'change_pending', 'canceled', 'expired',
    'attention_required'
  )),
  payment_status text not null check (payment_status in (
    'not_started', 'pending', 'authorized', 'paid', 'declined', 'canceled',
    'refund_pending', 'refunded', 'indeterminate'
  )),
  fulfillment_status text not null check (fulfillment_status in (
    'not_scheduled', 'scheduled', 'in_production', 'ready', 'completed',
    'canceled'
  )),
  requested_quantity integer not null check (requested_quantity > 0),
  total_minor integer not null check (total_minor >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  contact jsonb not null check (jsonb_typeof(contact) = 'object'),
  quote_snapshot jsonb not null check (jsonb_typeof(quote_snapshot) = 'object'),
  recovery_authority_hash text not null unique
    check (recovery_authority_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table momi_preorder.commands enable row level security;
alter table momi_preorder.checkout_holds enable row level security;
alter table momi_preorder.orders enable row level security;
revoke all on momi_preorder.commands, momi_preorder.checkout_holds,
  momi_preorder.orders from public, anon, authenticated, service_role;

create function momi_preorder.authority_hash_v1(p_authority text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(p_authority, 'UTF8'), 'sha256'), 'hex')
$$;

create function momi_preorder.request_digest_v1(p_request jsonb)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(
    convert_to(p_request::text, 'UTF8'), 'sha256'), 'hex')
$$;

create function momi_preorder.recovery_authority_v1(
  p_checkout_authority text, p_order_id uuid
) returns text language sql immutable set search_path = '' as $$
  select encode(extensions.hmac(
    convert_to('momi.preorder.recovery.v1:' || p_order_id::text, 'UTF8'),
    convert_to(p_checkout_authority, 'UTF8'), 'sha256'), 'hex')
$$;

create function momi_preorder.expire_checkout_holds_v1()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_hold momi_preorder.checkout_holds%rowtype;
  v_count integer := 0;
begin
  for v_hold in select * from momi_preorder.checkout_holds
    where hold_status = 'active' and expires_at <= clock_timestamp()
    order by expires_at for update skip locked
  loop
    update momi_preorder.fulfillment_windows set
      held_quantity = held_quantity - v_hold.held_quantity
      where window_id = v_hold.fulfillment_window_id;
    update momi_preorder.checkout_holds set hold_status = 'expired',
      released_at = clock_timestamp(), updated_at = clock_timestamp(),
      hold_version = hold_version + 1 where hold_id = v_hold.hold_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function momi_preorder.lifecycle_failure_v1(
  p_outcome text, p_code text, p_message text,
  p_retryable boolean, p_next_action text
) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('outcome', p_outcome, 'error', jsonb_build_object(
    'code', p_code, 'message', p_message,
    'retryable', p_retryable, 'next_action', p_next_action))
$$;

create function momi_preorder.manage_checkout_hold_v1(
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
    pg_catalog.hashtext('momi_preorder.hold:' || v_command_id::text));
  select * into v_existing from momi_preorder.commands
    where command_id = v_command_id;
  v_command_found := found;
  select * into v_quote from momi_preorder.quotes where quote_id = v_quote_id;
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
  if (p_request->>'expected_quote_version')::integer <> 1 then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'The quote version changed.', true, 'requote');
  end if;
  if v_action = 'create' then
    if clock_timestamp() >= v_quote.expires_at then
      return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
        'The quote expired.', true, 'requote');
    end if;
    select coalesce(sum((line->>'quantity')::integer), 0) into v_quantity
      from jsonb_array_elements(v_quote.request_snapshot->'lines') line;
    select * into v_window from momi_preorder.fulfillment_windows
      where window_id = v_quote.fulfillment_window_id for update;
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

create function momi_preorder.create_order_intent_v1(
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
    pg_catalog.hashtext('momi_preorder.order:' || v_command_id::text));
  select * into v_existing from momi_preorder.commands
    where command_id = v_command_id;
  v_command_found := found;
  select * into v_quote from momi_preorder.quotes where quote_id = v_quote_id;
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
  if (p_request->>'expected_quote_version')::integer <> 1
      or clock_timestamp() >= v_quote.expires_at then
    return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
      'The quote expired or changed.', true, 'requote');
  end if;
  if jsonb_typeof(p_request->'contact') <> 'object'
      or length(trim(p_request->'contact'->>'name')) not between 1 and 120
      or (nullif(trim(p_request->'contact'->>'email'), '') is null
        and nullif(trim(p_request->'contact'->>'phone'), '') is null) then
    return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
      'Customer contact information is incomplete.', false, 'none');
  end if;
  if exists (select 1 from momi_preorder.orders where quote_id = v_quote_id) then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'This quote already created an order.', false, 'refresh');
  end if;
  select coalesce(sum((line->>'quantity')::integer), 0) into v_quantity
    from jsonb_array_elements(v_quote.request_snapshot->'lines') line;
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_quote.fulfillment_window_id for update;
  if v_hold_id is not null then
    select * into v_hold from momi_preorder.checkout_holds
      where hold_id = v_hold_id and quote_id = v_quote.quote_id for update;
    if not found or v_hold.hold_status <> 'active'
        or v_hold.expires_at <= clock_timestamp() then
      return momi_preorder.lifecycle_failure_v1('conflict', 'quote_expired',
        'The checkout hold is no longer active.', true, 'requote');
    end if;
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
    order_id, quote_id, hold_id, fulfillment_window_id, order_status, payment_status,
    fulfillment_status, requested_quantity, total_minor, currency, contact,
    quote_snapshot, recovery_authority_hash
  ) values (v_order_id, v_quote.quote_id, v_hold_id, v_quote.fulfillment_window_id,
    'awaiting_payment', 'not_started', 'not_scheduled', v_quantity,
    v_quote.total_minor, 'USD', p_request->'contact', v_quote.response_snapshot,
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

create function momi_preorder.read_order_status_v1(
  p_order_id uuid, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare
  v_order momi_preorder.orders%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_surface momi_preorder.surfaces%rowtype;
  v_actions jsonb := jsonb_build_array('view_status');
begin
  if p_authority is null or length(p_authority) < 32 then return null; end if;
  select * into v_order from momi_preorder.orders where order_id = p_order_id
    and recovery_authority_hash = momi_preorder.authority_hash_v1(p_authority);
  if not found then return null; end if;
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_order.fulfillment_window_id;
  select s.* into v_surface from momi_preorder.surfaces s
    join momi_preorder.quotes q on q.surface_id = s.surface_id
    where q.quote_id = v_order.quote_id;
  if v_order.payment_status in ('declined', 'indeterminate') then
    v_actions := v_actions || case when v_order.payment_status = 'declined'
      then jsonb_build_array('retry_payment')
      else jsonb_build_array('reconcile_payment') end;
  end if;
  if coalesce((v_surface.cancellation_policy->>
      'customer_cancellation_allowed')::boolean, false) then
    v_actions := v_actions || jsonb_build_array('request_cancellation');
  end if;
  if coalesce((v_surface.cancellation_policy->>
      'customer_modification_allowed')::boolean, false) then
    v_actions := v_actions || jsonb_build_array('request_modification');
  end if;
  return jsonb_build_object('order_id', v_order.order_id,
    'order_version', v_order.order_version, 'order_status', v_order.order_status,
    'payment_status', v_order.payment_status,
    'fulfillment_status', v_order.fulfillment_status,
    'fulfillment_window', jsonb_build_object('window_id', v_window.window_id,
      'date', to_char(v_window.fulfillment_date, 'YYYY-MM-DD'),
      'starts_at', v_window.starts_at, 'ends_at', v_window.ends_at,
      'order_cutoff_at', v_window.order_cutoff_at,
      'availability', case when v_window.held_quantity +
        v_window.committed_quantity >= v_window.capacity_limit then 'sold_out'
        else 'available' end),
    'total', jsonb_build_object('currency', v_order.currency,
      'amount_minor', v_order.total_minor), 'allowed_actions', v_actions,
    'policy_summary', v_surface.cancellation_policy->>'summary',
    'updated_at', v_order.updated_at);
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
grant execute on function momi_preorder.manage_checkout_hold_v1(jsonb, text)
  to service_role;
grant execute on function momi_preorder.create_order_intent_v1(jsonb, text)
  to service_role;
grant execute on function momi_preorder.read_order_status_v1(uuid, text)
  to service_role;
