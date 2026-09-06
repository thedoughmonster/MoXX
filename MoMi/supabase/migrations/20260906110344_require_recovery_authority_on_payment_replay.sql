-- service-owner: preorder-operations

create or replace function momi_preorder.claim_payment_attempt_v1(
  p_request jsonb, p_authority text, p_location_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_order_id uuid := (p_request->>'order_id')::uuid;
  v_expected_version integer := (p_request->>'expected_order_version')::integer;
  v_digest text;
  v_existing momi_preorder.commands%rowtype;
  v_attempt momi_preorder.payment_attempts%rowtype;
  v_order momi_preorder.orders%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_terms jsonb;
  v_claim_id uuid := gen_random_uuid();
  v_attempt_number integer;
begin
  if jsonb_typeof(p_request) <> 'object' or p_authority is null
      or length(p_authority) < 32 or p_location_id is null
      or length(p_location_id) not between 1 and 64 then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Payment authority is invalid.', false, 'refresh');
  end if;
  v_digest := momi_preorder.request_digest_v1(jsonb_build_object(
    'order_id', v_order_id, 'expected_order_version', v_expected_version,
    'payment_location_id', p_location_id));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.command:' || v_command_id::text));
  select * into v_existing from momi_preorder.commands
    where command_id = v_command_id;
  if found then
    if v_existing.contract_key <> 'momi.preorder.payment.initiate.v1'
        or v_existing.request_digest <> v_digest then
      return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
        'This command was already used for different data.', false, 'refresh');
    end if;
    select * into v_order from momi_preorder.orders
      where order_id = v_order_id for update;
    if not found or v_order.recovery_authority_hash is distinct from
        momi_preorder.authority_hash_v1(p_authority) then
      return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
        'Payment authority is invalid.', false, 'refresh');
    end if;
    select * into v_attempt from momi_preorder.payment_attempts
      where payment_attempt_id =
        (v_existing.response_snapshot->>'payment_attempt_id')::uuid for update;
    if v_attempt.claim_kind = 'initiate'
        and v_attempt.claim_expires_at <= clock_timestamp()
        and v_attempt.evidence_version = 0
        and v_attempt.payment_status = 'pending' then
      update momi_preorder.payment_attempts set payment_status = 'indeterminate',
        requires_review = true, claim_id = null, claim_kind = null,
        claim_expires_at = null, updated_at = clock_timestamp()
        where payment_attempt_id = v_attempt.payment_attempt_id
        returning * into v_attempt;
      update momi_preorder.orders set order_status = 'attention_required',
        payment_status = 'indeterminate', order_version = order_version + 1,
        updated_at = clock_timestamp() where order_id = v_attempt.order_id;
    end if;
    return momi_preorder.payment_claim_envelope_v1(
      case when v_attempt.claim_expires_at > clock_timestamp()
        then 'busy' when v_attempt.payment_status in
          ('paid', 'declined', 'canceled', 'refunded')
        then 'already_terminal' else 'replay' end,
      v_attempt.payment_attempt_id);
  end if;
  select * into v_order from momi_preorder.orders
    where order_id = v_order_id for update;
  if not found or v_order.recovery_authority_hash is distinct from
      momi_preorder.authority_hash_v1(p_authority) then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Payment authority is invalid.', false, 'refresh');
  end if;
  if v_order.order_version <> v_expected_version then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'The order version changed.', true, 'refresh');
  end if;
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_order.fulfillment_window_id;
  if not found or not v_window.enabled
      or clock_timestamp() >= v_window.order_cutoff_at
      or clock_timestamp() >= v_window.starts_at then
    return momi_preorder.lifecycle_failure_v1('conflict', 'window_closed',
      'Payment can no longer start for this pickup window.', false, 'refresh');
  end if;
  select * into v_attempt from momi_preorder.payment_attempts
    where order_id = v_order.order_id
    order by attempt_number desc limit 1 for update;
  if found and v_attempt.payment_status in
      ('pending', 'authorized', 'indeterminate', 'refund_pending') then
    return momi_preorder.payment_claim_envelope_v1('busy',
      v_attempt.payment_attempt_id);
  end if;
  if v_order.payment_status in
      ('authorized', 'paid', 'refund_pending', 'refunded') then
    if found then
      return momi_preorder.payment_claim_envelope_v1('already_terminal',
        v_attempt.payment_attempt_id);
    end if;
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'This order cannot start another payment.', false, 'refresh');
  end if;
  if v_order.order_status not in ('awaiting_payment', 'attention_required')
      or v_order.payment_status not in ('not_started', 'declined', 'canceled') then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'This order cannot start another payment.', false, 'refresh');
  end if;
  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
    from momi_preorder.payment_attempts where order_id = v_order.order_id;
  v_terms := jsonb_build_object(
    'order_id', v_order.order_id,
    'order_version', v_order.order_version,
    'quote_id', v_order.quote_id,
    'quote_version', coalesce(
      (v_order.quote_snapshot#>>'{quote,quote_version}')::integer, 1),
    'versions', coalesce(v_order.quote_snapshot#>'{quote,versions}', '{}'::jsonb),
    'amount', jsonb_build_object('currency', v_order.currency,
      'amount_minor', v_order.total_minor),
    'payment_location_id', p_location_id,
    'accepted_policy', v_order.policy_snapshot
  );
  insert into momi_preorder.payment_attempts (
    order_id, attempt_number, initiate_command_id, initiate_request_digest,
    order_version_at_claim, amount_minor, currency, payment_location_id,
    accepted_terms, accepted_terms_digest, payment_status,
    claim_id, claim_kind, claim_expires_at
  ) values (
    v_order.order_id, v_attempt_number, v_command_id, v_digest,
    v_order.order_version, v_order.total_minor, v_order.currency, p_location_id,
    v_terms, momi_preorder.request_digest_v1(v_terms), 'pending',
    v_claim_id, 'initiate', clock_timestamp() + interval '30 seconds'
  ) returning * into v_attempt;
  insert into momi_preorder.commands (
    command_id, contract_key, request_digest, response_snapshot
  ) values (v_command_id, 'momi.preorder.payment.initiate.v1', v_digest,
    jsonb_build_object('payment_attempt_id', v_attempt.payment_attempt_id));
  update momi_preorder.orders set order_status = 'payment_pending',
    payment_status = 'pending', order_version = order_version + 1,
    updated_at = clock_timestamp() where order_id = v_order.order_id;
  return momi_preorder.payment_claim_envelope_v1('claimed',
    v_attempt.payment_attempt_id, v_claim_id, 'initiate');
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed or check_violation then
  return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
    'The payment request is invalid.', false, 'none');
end;
$$;
