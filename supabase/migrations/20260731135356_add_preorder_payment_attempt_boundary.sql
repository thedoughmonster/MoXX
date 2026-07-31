-- service-owner: preorder-operations

create table momi_preorder.payment_attempts (
  payment_attempt_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references momi_preorder.orders(order_id),
  attempt_number integer not null check (attempt_number > 0),
  initiate_command_id uuid not null unique,
  initiate_request_digest text not null
    check (initiate_request_digest ~ '^[0-9a-f]{64}$'),
  order_version_at_claim integer not null check (order_version_at_claim > 0),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_location_id text not null
    check (length(payment_location_id) between 1 and 64),
  accepted_terms jsonb not null check (jsonb_typeof(accepted_terms) = 'object'),
  accepted_terms_digest text not null
    check (accepted_terms_digest ~ '^[0-9a-f]{64}$'),
  payment_status text not null check (payment_status in (
    'pending', 'authorized', 'paid', 'declined', 'canceled',
    'refund_pending', 'refunded', 'indeterminate'
  )),
  provider_payment_id text check (
    provider_payment_id is null or length(provider_payment_id) between 1 and 192
  ),
  provider_updated_at timestamptz,
  claim_id uuid,
  claim_kind text check (claim_kind is null or claim_kind in ('initiate', 'reconcile')),
  claim_expires_at timestamptz,
  evidence_version integer not null default 0 check (evidence_version >= 0),
  requires_review boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (order_id, attempt_number),
  check ((claim_id is null and claim_kind is null and claim_expires_at is null)
    or (claim_id is not null and claim_kind is not null
      and claim_expires_at is not null))
);

create unique index payment_attempts_provider_identity
  on momi_preorder.payment_attempts(provider_payment_id)
  where provider_payment_id is not null;

create unique index payment_attempts_one_unresolved_per_order
  on momi_preorder.payment_attempts(order_id)
  where payment_status in ('pending', 'authorized', 'indeterminate',
    'refund_pending');

alter table momi_preorder.commands
  drop constraint commands_contract_key_check;
alter table momi_preorder.commands
  add constraint commands_contract_key_check check (contract_key in (
    'momi.preorder.checkout_hold.manage.v1',
    'momi.preorder.order_intent.create.v1',
    'momi.preorder.payment.initiate.v1',
    'momi.preorder.payment.reconcile.v1'
  ));

create table momi_preorder.payment_evidence (
  evidence_key_hash text primary key check (evidence_key_hash ~ '^[0-9a-f]{64}$'),
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  payment_attempt_id uuid not null
    references momi_preorder.payment_attempts(payment_attempt_id),
  evidence_source text not null check (
    evidence_source in ('delivery', 'reconciliation', 'webhook')
  ),
  provider_payment_id text check (
    provider_payment_id is null or length(provider_payment_id) between 1 and 192
  ),
  payment_status text not null check (payment_status in (
    'pending', 'authorized', 'paid', 'declined', 'canceled',
    'refund_pending', 'refunded', 'indeterminate'
  )),
  provider_updated_at timestamptz,
  disposition text not null check (disposition in (
    'matched', 'mismatch', 'missing', 'indeterminate', 'duplicate',
    'stale', 'conflict'
  )),
  applied boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create index payment_evidence_attempt_order
  on momi_preorder.payment_evidence(payment_attempt_id, created_at);

alter table momi_preorder.payment_attempts enable row level security;
alter table momi_preorder.payment_evidence enable row level security;
revoke all on momi_preorder.payment_attempts, momi_preorder.payment_evidence
  from public, anon, authenticated, service_role;

create or replace function momi_preorder.admit_public_request_v1(
  p_contract_key text, p_principal text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  admitted boolean;
  bucket timestamptz := date_trunc('minute', clock_timestamp());
  global_limit integer;
  principal_limit integer;
  global_hash text := momi_preorder.authority_hash_v1(
    'momi.preorder.global_request_rate.v1');
  v_principal_hash text;
begin
  principal_limit := case p_contract_key
    when 'momi.preorder.checkout_hold.manage.v1' then 60
    when 'momi.preorder.order_intent.create.v1' then 20
    when 'momi.preorder.order_status.read.v1' then 120
    when 'momi.preorder.payment.initiate.v1' then 10
    when 'momi.preorder.payment.reconcile.v1' then 30
    else null
  end;
  global_limit := case p_contract_key
    when 'momi.preorder.checkout_hold.manage.v1' then 300
    when 'momi.preorder.order_intent.create.v1' then 120
    when 'momi.preorder.order_status.read.v1' then 600
    when 'momi.preorder.payment.initiate.v1' then 60
    when 'momi.preorder.payment.reconcile.v1' then 180
    else null
  end;
  if principal_limit is null or p_principal is null
      or length(p_principal) not between 32 and 512 then
    return false;
  end if;
  v_principal_hash := momi_preorder.authority_hash_v1(p_principal);
  delete from momi_preorder.public_request_rate_buckets
    where bucket_started_at < bucket - interval '10 minutes';
  insert into momi_preorder.public_request_rate_buckets (
    contract_key, principal_hash, bucket_started_at, request_count
  ) values (p_contract_key, global_hash, bucket, 1)
  on conflict (contract_key, principal_hash, bucket_started_at) do update
    set request_count =
      momi_preorder.public_request_rate_buckets.request_count + 1
    where momi_preorder.public_request_rate_buckets.request_count < global_limit
  returning true into admitted;
  if not coalesce(admitted, false) then return false; end if;
  admitted := null;
  insert into momi_preorder.public_request_rate_buckets (
    contract_key, principal_hash, bucket_started_at, request_count
  ) values (p_contract_key, v_principal_hash, bucket, 1)
  on conflict (contract_key, principal_hash, bucket_started_at) do update
    set request_count =
      momi_preorder.public_request_rate_buckets.request_count + 1
    where momi_preorder.public_request_rate_buckets.request_count < principal_limit
  returning true into admitted;
  return coalesce(admitted, false);
end;
$$;

create function momi_preorder.payment_transition_allowed_v1(
  p_from text, p_to text
) returns boolean language sql immutable set search_path = '' as $$
  select p_from = p_to or case p_from
    when 'pending' then p_to in (
      'authorized', 'paid', 'declined', 'canceled', 'indeterminate')
    when 'authorized' then p_to in ('paid', 'canceled', 'indeterminate')
    when 'paid' then p_to in ('refund_pending', 'refunded')
    when 'refund_pending' then p_to in ('paid', 'refunded', 'indeterminate')
    when 'indeterminate' then p_to in (
      'pending', 'authorized', 'paid', 'declined', 'canceled',
      'refund_pending', 'refunded')
    else false
  end
$$;

create function momi_preorder.payment_next_actions_v1(
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
  if p_payment_status in ('pending', 'authorized') then
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

create function momi_preorder.payment_receipt_v1(p_payment_attempt_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_attempt momi_preorder.payment_attempts%rowtype;
  v_order momi_preorder.orders%rowtype;
  v_outcome text;
begin
  select * into v_attempt from momi_preorder.payment_attempts
    where payment_attempt_id = p_payment_attempt_id;
  if not found then return null; end if;
  select * into v_order from momi_preorder.orders
    where order_id = v_attempt.order_id;
  v_outcome := case v_attempt.payment_status
    when 'paid' then 'accepted'
    when 'refunded' then 'accepted'
    when 'declined' then 'rejected'
    when 'canceled' then 'rejected'
    when 'indeterminate' then 'indeterminate'
    else 'pending'
  end;
  return jsonb_build_object(
    'outcome', v_outcome,
    'order_id', v_order.order_id,
    'order_version', v_order.order_version,
    'payment_attempt_id', v_attempt.payment_attempt_id,
    'payment_status', v_attempt.payment_status,
    'amount', jsonb_build_object('currency', v_attempt.currency,
      'amount_minor', v_attempt.amount_minor),
    'next_actions', momi_preorder.payment_next_actions_v1(
      v_order.order_id, v_attempt.payment_status)
  );
end;
$$;

create function momi_preorder.payment_claim_envelope_v1(
  p_disposition text, p_payment_attempt_id uuid,
  p_claim_id uuid default null, p_claim_kind text default null
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_attempt momi_preorder.payment_attempts%rowtype;
  v_claim jsonb := null;
begin
  select * into v_attempt from momi_preorder.payment_attempts
    where payment_attempt_id = p_payment_attempt_id;
  if not found then return null; end if;
  if p_claim_id is not null then
    v_claim := jsonb_build_object(
      'claim_id', p_claim_id,
      'claim_kind', p_claim_kind,
      'payment_attempt_id', v_attempt.payment_attempt_id,
      'owner_order_id', v_attempt.order_id,
      'amount_minor', v_attempt.amount_minor,
      'currency', v_attempt.currency,
      'location_id', v_attempt.payment_location_id,
      'provider_payment_id', v_attempt.provider_payment_id
    );
  end if;
  return jsonb_build_object(
    'disposition', p_disposition,
    'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id),
    'claim', v_claim
  );
end;
$$;

create function momi_preorder.claim_payment_attempt_v1(
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

create function momi_preorder.claim_payment_reconciliation_v1(
  p_request jsonb, p_authority text, p_location_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_order_id uuid := (p_request->>'order_id')::uuid;
  v_attempt_id uuid := (p_request->>'payment_attempt_id')::uuid;
  v_expected_version integer := (p_request->>'expected_order_version')::integer;
  v_digest text;
  v_existing momi_preorder.commands%rowtype;
  v_attempt momi_preorder.payment_attempts%rowtype;
  v_order momi_preorder.orders%rowtype;
  v_claim_id uuid := gen_random_uuid();
begin
  if jsonb_typeof(p_request) <> 'object' or p_authority is null
      or length(p_authority) < 32 or p_location_id is null
      or length(p_location_id) not between 1 and 64 then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_authorized',
      'Payment authority is invalid.', false, 'refresh');
  end if;
  v_digest := momi_preorder.request_digest_v1(jsonb_build_object(
    'order_id', v_order_id, 'expected_order_version', v_expected_version,
    'payment_attempt_id', v_attempt_id,
    'payment_location_id', p_location_id));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.command:' || v_command_id::text));
  select * into v_existing from momi_preorder.commands
    where command_id = v_command_id;
  if found and (v_existing.contract_key <>
      'momi.preorder.payment.reconcile.v1'
      or v_existing.request_digest <> v_digest
      or (v_existing.response_snapshot->>'payment_attempt_id')::uuid <>
        v_attempt_id) then
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
  if v_order.order_version <> v_expected_version then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'The order version changed.', true, 'refresh');
  end if;
  select * into v_attempt from momi_preorder.payment_attempts
    where payment_attempt_id = v_attempt_id and order_id = v_order_id for update;
  if not found or v_attempt.payment_location_id <> p_location_id then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_found',
      'The payment attempt was not found.', false, 'refresh');
  end if;
  if v_existing.command_id is null then
    insert into momi_preorder.commands (
      command_id, contract_key, request_digest, response_snapshot
    ) values (v_command_id, 'momi.preorder.payment.reconcile.v1', v_digest,
      jsonb_build_object('payment_attempt_id', v_attempt.payment_attempt_id));
  end if;
  if v_attempt.payment_status in ('paid', 'declined', 'canceled', 'refunded') then
    return momi_preorder.payment_claim_envelope_v1('already_terminal',
      v_attempt.payment_attempt_id);
  end if;
  if v_attempt.claim_expires_at > clock_timestamp() then
    return momi_preorder.payment_claim_envelope_v1('busy',
      v_attempt.payment_attempt_id);
  end if;
  if v_attempt.provider_payment_id is null then
    update momi_preorder.payment_attempts set payment_status = 'indeterminate',
      requires_review = true, claim_id = null, claim_kind = null,
      claim_expires_at = null, updated_at = clock_timestamp()
      where payment_attempt_id = v_attempt.payment_attempt_id;
    update momi_preorder.orders set order_status = 'attention_required',
      payment_status = 'indeterminate', order_version = order_version + 1,
      updated_at = clock_timestamp() where order_id = v_order.order_id
        and payment_status <> 'indeterminate';
    return momi_preorder.payment_claim_envelope_v1('operator_review',
      v_attempt.payment_attempt_id);
  end if;
  update momi_preorder.payment_attempts set claim_id = v_claim_id,
    claim_kind = 'reconcile',
    claim_expires_at = clock_timestamp() + interval '30 seconds',
    updated_at = clock_timestamp()
    where payment_attempt_id = v_attempt.payment_attempt_id;
  return momi_preorder.payment_claim_envelope_v1('claimed',
    v_attempt.payment_attempt_id, v_claim_id, 'reconcile');
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed or check_violation then
  return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
    'The reconciliation request is invalid.', false, 'none');
end;
$$;

create function momi_preorder.project_payment_evidence_v1(
  p_payment_attempt_id uuid, p_claim_id uuid, p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_attempt momi_preorder.payment_attempts%rowtype;
  v_order momi_preorder.orders%rowtype;
  v_order_id uuid;
  v_source text := p_evidence->>'source';
  v_disposition text := p_evidence->>'disposition';
  v_status text := p_evidence->>'payment_status';
  v_provider_id text := nullif(p_evidence->>'provider_payment_id', '');
  v_provider_updated_at timestamptz :=
    nullif(p_evidence->>'provider_updated_at', '')::timestamptz;
  v_evidence_hash text;
  v_digest text;
  v_existing momi_preorder.payment_evidence%rowtype;
  v_identity_matches boolean;
  v_other_unresolved boolean;
begin
  if jsonb_typeof(p_evidence) <> 'object'
      or length(p_evidence->>'evidence_id') not between 1 and 192
      or v_source not in ('delivery', 'reconciliation', 'webhook')
      or v_disposition not in ('matched', 'mismatch', 'missing', 'indeterminate')
      or v_status not in ('pending', 'authorized', 'paid', 'declined',
        'canceled', 'refund_pending', 'refunded', 'indeterminate') then
    return momi_preorder.lifecycle_failure_v1('rejected', 'invalid_request',
      'The payment evidence is invalid.', false, 'none');
  end if;
  select order_id into v_order_id from momi_preorder.payment_attempts
    where payment_attempt_id = p_payment_attempt_id;
  if not found then
    return momi_preorder.lifecycle_failure_v1('rejected', 'not_found',
      'The payment attempt was not found.', false, 'none');
  end if;
  select * into v_order from momi_preorder.orders
    where order_id = v_order_id for update;
  select * into v_attempt from momi_preorder.payment_attempts
    where payment_attempt_id = p_payment_attempt_id
      and order_id = v_order.order_id for update;
  select exists (select 1 from momi_preorder.payment_attempts
    where order_id = v_attempt.order_id
      and payment_attempt_id <> v_attempt.payment_attempt_id
      and payment_status in ('pending', 'authorized', 'indeterminate',
        'refund_pending')) into v_other_unresolved;
  v_evidence_hash := momi_preorder.authority_hash_v1(
    'momi.preorder.payment.evidence.v1:' || (p_evidence->>'evidence_id'));
  v_digest := momi_preorder.request_digest_v1(p_evidence);
  select * into v_existing from momi_preorder.payment_evidence
    where evidence_key_hash = v_evidence_hash;
  if found then
    if v_existing.payment_attempt_id <> p_payment_attempt_id
        or v_existing.request_digest <> v_digest then
      update momi_preorder.payment_attempts set requires_review = true,
        updated_at = clock_timestamp()
        where payment_attempt_id = p_payment_attempt_id;
      update momi_preorder.orders set order_status = 'attention_required',
        order_version = order_version + 1, updated_at = clock_timestamp()
        where order_id = v_order.order_id
          and order_status <> 'attention_required';
      return jsonb_build_object('disposition', 'conflict',
        'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
    end if;
    return jsonb_build_object('disposition', 'duplicate',
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  if v_source in ('delivery', 'reconciliation') and (
      p_claim_id is null or v_attempt.claim_id is distinct from p_claim_id
      or v_attempt.claim_kind is distinct from case v_source
        when 'delivery' then 'initiate' else 'reconcile' end) then
    return momi_preorder.lifecycle_failure_v1('conflict', 'stale_version',
      'The payment claim is no longer current.', false, 'refresh');
  end if;
  insert into momi_preorder.payment_evidence (
    evidence_key_hash, request_digest, payment_attempt_id, evidence_source,
    provider_payment_id, payment_status, provider_updated_at, disposition
  ) values (v_evidence_hash, v_digest, p_payment_attempt_id, v_source,
    v_provider_id, v_status, v_provider_updated_at, v_disposition);
  v_identity_matches := (p_evidence->>'order_id')::uuid = v_attempt.order_id
    and (p_evidence->>'amount_minor')::integer = v_attempt.amount_minor
    and p_evidence->>'currency' = v_attempt.currency
    and p_evidence->>'location_id' = v_attempt.payment_location_id
    and (v_attempt.provider_payment_id is null
      or v_attempt.provider_payment_id = v_provider_id)
    and not exists (select 1 from momi_preorder.payment_attempts other
      where other.provider_payment_id = v_provider_id
        and other.payment_attempt_id <> v_attempt.payment_attempt_id);
  if v_disposition <> 'matched' or not coalesce(v_identity_matches, false)
      or v_provider_id is null or v_provider_updated_at is null then
    update momi_preorder.payment_evidence set disposition = case
      when v_disposition = 'matched' then 'mismatch' else v_disposition end
      where evidence_key_hash = v_evidence_hash;
    update momi_preorder.payment_attempts set
      payment_status = case when payment_status in ('paid', 'refunded')
          or v_other_unresolved
        then payment_status else 'indeterminate' end,
      requires_review = true,
      claim_id = case when v_source = 'webhook' then claim_id else null end,
      claim_kind = case when v_source = 'webhook' then claim_kind else null end,
      claim_expires_at = case when v_source = 'webhook'
        then claim_expires_at else null end,
      updated_at = clock_timestamp()
      where payment_attempt_id = p_payment_attempt_id;
    update momi_preorder.orders set order_status = 'attention_required',
      payment_status = case when payment_status in ('paid', 'refunded')
        then payment_status else 'indeterminate' end,
      order_version = order_version + 1, updated_at = clock_timestamp()
      where order_id = v_order.order_id;
    return jsonb_build_object('disposition', case
      when v_disposition = 'matched' then 'mismatch' else v_disposition end,
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  if v_attempt.provider_updated_at is not null
      and v_provider_updated_at < v_attempt.provider_updated_at then
    update momi_preorder.payment_evidence set disposition = 'stale'
      where evidence_key_hash = v_evidence_hash;
    if v_attempt.claim_id is not distinct from p_claim_id then
      update momi_preorder.payment_attempts set claim_id = null,
        claim_kind = null, claim_expires_at = null,
        updated_at = clock_timestamp()
        where payment_attempt_id = p_payment_attempt_id;
    end if;
    return jsonb_build_object('disposition', 'stale',
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  if v_attempt.provider_updated_at is not null
      and v_provider_updated_at = v_attempt.provider_updated_at
      and (v_attempt.payment_status <> v_status
        or v_attempt.provider_payment_id is distinct from v_provider_id) then
    update momi_preorder.payment_evidence set disposition = 'conflict'
      where evidence_key_hash = v_evidence_hash;
    update momi_preorder.payment_attempts set requires_review = true,
      claim_id = null, claim_kind = null, claim_expires_at = null,
      updated_at = clock_timestamp()
      where payment_attempt_id = p_payment_attempt_id;
    update momi_preorder.orders set order_status = 'attention_required',
      order_version = order_version + 1, updated_at = clock_timestamp()
      where order_id = v_order.order_id;
    return jsonb_build_object('disposition', 'conflict',
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  if v_attempt.provider_updated_at is not null
      and v_provider_updated_at = v_attempt.provider_updated_at then
    update momi_preorder.payment_evidence set disposition = 'duplicate'
      where evidence_key_hash = v_evidence_hash;
    if v_source <> 'webhook' then
      update momi_preorder.payment_attempts set claim_id = null,
        claim_kind = null, claim_expires_at = null,
        updated_at = clock_timestamp()
        where payment_attempt_id = p_payment_attempt_id;
    end if;
    return jsonb_build_object('disposition', 'duplicate',
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  if not momi_preorder.payment_transition_allowed_v1(
      v_attempt.payment_status, v_status) then
    update momi_preorder.payment_evidence set disposition = 'conflict'
      where evidence_key_hash = v_evidence_hash;
    update momi_preorder.payment_attempts set requires_review = true,
      claim_id = null, claim_kind = null, claim_expires_at = null,
      updated_at = clock_timestamp()
      where payment_attempt_id = p_payment_attempt_id;
    update momi_preorder.orders set order_status = 'attention_required',
      order_version = order_version + 1, updated_at = clock_timestamp()
      where order_id = v_order.order_id;
    return jsonb_build_object('disposition', 'conflict',
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  if v_status = 'paid' and v_other_unresolved then
    update momi_preorder.payment_evidence set disposition = 'conflict'
      where evidence_key_hash = v_evidence_hash;
    update momi_preorder.payment_attempts set requires_review = true,
      claim_id = null, claim_kind = null, claim_expires_at = null,
      updated_at = clock_timestamp()
      where payment_attempt_id = p_payment_attempt_id;
    update momi_preorder.orders set order_status = 'attention_required',
      payment_status = 'indeterminate', order_version = order_version + 1,
      updated_at = clock_timestamp() where order_id = v_order.order_id;
    return jsonb_build_object('disposition', 'conflict',
      'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
  end if;
  update momi_preorder.payment_attempts set payment_status = v_status,
    provider_payment_id = v_provider_id,
    provider_updated_at = v_provider_updated_at,
    evidence_version = evidence_version + 1, requires_review = false,
    claim_id = case when v_source = 'webhook' then claim_id else null end,
    claim_kind = case when v_source = 'webhook' then claim_kind else null end,
    claim_expires_at = case when v_source = 'webhook'
      then claim_expires_at else null end,
    updated_at = clock_timestamp()
    where payment_attempt_id = p_payment_attempt_id;
  update momi_preorder.orders set
    order_status = case v_status
      when 'pending' then 'payment_pending'
      when 'authorized' then 'payment_pending'
      when 'paid' then case when order_status in (
        'awaiting_payment', 'payment_pending', 'attention_required')
        then 'confirmed' else order_status end
      when 'declined' then 'awaiting_payment'
      when 'canceled' then 'awaiting_payment'
      when 'indeterminate' then 'attention_required'
      when 'refund_pending' then 'change_pending'
      when 'refunded' then case when order_status = 'canceled'
        then 'canceled' else 'attention_required' end
    end,
    payment_status = v_status, order_version = order_version + 1,
    updated_at = clock_timestamp() where order_id = v_order.order_id;
  update momi_preorder.payment_evidence set applied = true
    where evidence_key_hash = v_evidence_hash;
  return jsonb_build_object('disposition', 'applied',
    'receipt', momi_preorder.payment_receipt_v1(p_payment_attempt_id));
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed or check_violation or unique_violation then
  return momi_preorder.lifecycle_failure_v1('rejected', 'payment_indeterminate',
    'Payment evidence could not be reconciled safely.', false, 'contact_shop');
end;
$$;

create function momi_preorder.read_payment_attempt_v1(
  p_order_id uuid, p_payment_attempt_id uuid, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare
  v_order momi_preorder.orders%rowtype;
begin
  if p_authority is null or length(p_authority) < 32 then return null; end if;
  select * into v_order from momi_preorder.orders where order_id = p_order_id
    and recovery_authority_hash = momi_preorder.authority_hash_v1(p_authority);
  if not found or not exists (select 1 from momi_preorder.payment_attempts
      where payment_attempt_id = p_payment_attempt_id and order_id = p_order_id)
  then return null; end if;
  return momi_preorder.payment_receipt_v1(p_payment_attempt_id);
end;
$$;

create or replace function momi_preorder.read_order_status_v1(
  p_order_id uuid, p_authority text
) returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare
  v_order momi_preorder.orders%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_actions jsonb := jsonb_build_array('view_status');
  v_before_change_cutoff boolean;
begin
  if p_authority is null or length(p_authority) < 32 then return null; end if;
  select * into v_order from momi_preorder.orders where order_id = p_order_id
    and recovery_authority_hash = momi_preorder.authority_hash_v1(p_authority);
  if not found then return null; end if;
  select * into v_window from momi_preorder.fulfillment_windows
    where window_id = v_order.fulfillment_window_id;
  v_before_change_cutoff := v_window.enabled
    and statement_timestamp() < v_window.order_cutoff_at
    and statement_timestamp() < v_window.starts_at
    and v_order.fulfillment_status in ('not_scheduled', 'scheduled');
  if v_order.payment_status in ('pending', 'authorized') then
    v_actions := v_actions || jsonb_build_array('reconcile_payment');
  elsif v_order.payment_status = 'indeterminate' then
    v_actions := v_actions || jsonb_build_array(
      'reconcile_payment', 'contact_shop');
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

revoke all on all functions in schema momi_preorder
  from public, anon, authenticated, service_role;
grant usage on schema momi_preorder to service_role;
grant execute on function momi_preorder.admit_public_read_v1(text)
  to service_role;
grant execute on function momi_preorder.admit_public_request_v1(text, text)
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
grant execute on function momi_preorder.claim_payment_attempt_v1(jsonb, text, text)
  to service_role;
grant execute on function momi_preorder.claim_payment_reconciliation_v1(
  jsonb, text, text) to service_role;
grant execute on function momi_preorder.project_payment_evidence_v1(
  uuid, uuid, jsonb) to service_role;
grant execute on function momi_preorder.read_payment_attempt_v1(uuid, uuid, text)
  to service_role;
