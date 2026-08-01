-- service-owner: preorder-operations

create or replace function momi_preorder.payment_next_actions_v1(
  p_order_id uuid, p_payment_status text
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_order momi_preorder.orders%rowtype;
  v_actions jsonb := jsonb_build_array('view_status');
  v_before_cutoff boolean;
begin
  select * into v_order from momi_preorder.orders where order_id = p_order_id;
  if not found then return '[]'::jsonb; end if;
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_order.fulfillment_window_id;
  v_before_cutoff := found and v_window.enabled
    and statement_timestamp() < v_window.order_cutoff_at
    and statement_timestamp() < v_window.starts_at
    and v_order.fulfillment_status in ('not_scheduled', 'scheduled');
  if p_payment_status = 'not_started' and v_before_cutoff then
    v_actions := v_actions || jsonb_build_array('initiate_payment');
  elsif p_payment_status in ('pending', 'authorized') then
    v_actions := v_actions || jsonb_build_array('reconcile_payment');
  elsif p_payment_status = 'indeterminate' then
    v_actions := v_actions || jsonb_build_array(
      'reconcile_payment', 'contact_shop');
  elsif p_payment_status in ('declined', 'canceled') and v_before_cutoff then
    v_actions := v_actions || jsonb_build_array('retry_payment');
  elsif p_payment_status in ('refund_pending', 'refunded') then
    v_actions := v_actions || jsonb_build_array('contact_shop');
  end if;
  return v_actions;
end;
$$;

create or replace function momi_preorder.read_order_status_v1(
  p_order_id uuid, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare
  v_order momi_preorder.orders%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_payment_attempt_id uuid;
  v_actions jsonb := jsonb_build_array('view_status');
  v_before_change_cutoff boolean;
begin
  if p_authority is null or length(p_authority) < 32 then return null; end if;
  select * into v_order from momi_preorder.orders where order_id = p_order_id
    and recovery_authority_hash = momi_preorder.authority_hash_v1(p_authority);
  if not found then return null; end if;
  select payment_attempt_id into v_payment_attempt_id
    from momi_preorder.payment_attempts
    where order_id = v_order.order_id
    order by attempt_number desc limit 1;
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_order.fulfillment_window_id;
  v_before_change_cutoff := v_window.enabled
    and statement_timestamp() < v_window.order_cutoff_at
    and statement_timestamp() < v_window.starts_at
    and v_order.fulfillment_status in ('not_scheduled', 'scheduled');
  if v_order.payment_status = 'not_started' and v_before_change_cutoff then
    v_actions := v_actions || jsonb_build_array('initiate_payment');
  elsif v_order.payment_status in ('pending', 'authorized')
      and v_payment_attempt_id is not null then
    v_actions := v_actions || jsonb_build_array('reconcile_payment');
  elsif v_order.payment_status = 'indeterminate'
      and v_payment_attempt_id is not null then
    v_actions := v_actions || jsonb_build_array(
      'reconcile_payment', 'contact_shop');
  elsif v_order.payment_status in ('pending', 'authorized', 'indeterminate') then
    v_actions := v_actions || jsonb_build_array('contact_shop');
  elsif v_order.payment_status in ('declined', 'canceled')
      and v_before_change_cutoff then
    v_actions := v_actions || jsonb_build_array('retry_payment');
  elsif v_order.payment_status in ('refund_pending', 'refunded') then
    v_actions := v_actions || jsonb_build_array('contact_shop');
  end if;
  if v_order.order_status = 'attention_required'
      and not (v_actions ? 'contact_shop') then
    v_actions := v_actions || jsonb_build_array('contact_shop');
  end if;
  if v_before_change_cutoff
      and v_order.order_status in ('awaiting_payment', 'confirmed')
      and v_order.payment_status in (
        'not_started', 'declined', 'canceled', 'authorized', 'paid')
      and coalesce((v_order.policy_snapshot->>
        'customer_cancellation_allowed')::boolean, false) then
    v_actions := v_actions || jsonb_build_array('request_cancellation');
  end if;
  if v_before_change_cutoff
      and v_order.order_status in ('awaiting_payment', 'confirmed')
      and v_order.payment_status in (
        'not_started', 'declined', 'canceled', 'authorized', 'paid')
      and coalesce((v_order.policy_snapshot->>
        'customer_modification_allowed')::boolean, false) then
    v_actions := v_actions || jsonb_build_array('request_modification');
  end if;
  return jsonb_build_object('order_id', v_order.order_id,
    'order_version', v_order.order_version, 'order_status', v_order.order_status,
    'payment_attempt_id', v_payment_attempt_id,
    'payment_status', v_order.payment_status,
    'fulfillment_status', v_order.fulfillment_status,
    'fulfillment_window', jsonb_build_object('window_id', v_window.window_id,
      'date', to_char(v_window.fulfillment_date, 'YYYY-MM-DD'),
      'starts_at', v_window.starts_at, 'ends_at', v_window.ends_at,
      'order_cutoff_at', v_window.order_cutoff_at,
      'availability', case
        when not v_window.enabled or statement_timestamp() >=
          v_window.order_cutoff_at then 'closed'
        when v_window.held_quantity + v_window.committed_quantity >=
          v_window.capacity_limit then 'sold_out'
        when v_window.capacity_limit - v_window.held_quantity -
          v_window.committed_quantity <= v_window.limited_threshold then 'limited'
        else 'available' end),
    'total', jsonb_build_object('currency', v_order.currency,
      'amount_minor', v_order.total_minor), 'allowed_actions', v_actions,
    'policy_summary', v_order.policy_snapshot->>'summary',
    'updated_at', v_order.updated_at);
end;
$$;

revoke all on function momi_preorder.payment_next_actions_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function momi_preorder.read_order_status_v1(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function momi_preorder.read_order_status_v1(uuid, text)
  to service_role;
