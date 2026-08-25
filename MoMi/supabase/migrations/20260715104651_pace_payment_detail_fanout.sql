-- service-owner: toast-data-acquisition

create or replace function toast_acquisition.enqueue_payment_detail_jobs(
  p_parent_job_id bigint,
  p_capability_token uuid,
  p_payment_guids text[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  detail_key text;
  guid_pattern text;
  inserted integer;
begin
  if not exists (
    select 1 from toast_acquisition.jobs as parent
    where parent.job_id = p_parent_job_id
      and parent.capability_token = p_capability_token
      and parent.operation_key = 'toast.payments.list.v1'
      and parent.status = 'running' and parent.lease_expires_at > now()
  ) then
    raise exception 'Payment list parent lease is invalid';
  end if;
  select operation.operation_key, parameter.validation_pattern
  into detail_key, guid_pattern
  from toast_acquisition.operations as operation
  join toast_acquisition.operation_parameters as parameter
    on parameter.operation_key = operation.operation_key
    and parameter.parameter_key = 'guid'
    and parameter.parameter_location = 'path'
    and parameter.data_type = 'string' and parameter.required
  where operation.operation_key = 'toast.payments.get.v1'
    and operation.source_operation_id = 'paymentsGuidGet'
    and operation.response_kind = 'document'
    and operation.pagination_kind = 'none'
    and operation.exact_resource_only and operation.is_enabled;
  if detail_key is null or guid_pattern is null then
    raise exception 'Registered payment detail operation is unavailable';
  end if;
  if p_payment_guids is null or exists (
    select 1 from unnest(p_payment_guids) as payment(guid)
    where payment.guid is null or payment.guid !~ guid_pattern
  ) then
    raise exception 'Payment list contained an invalid GUID';
  end if;
  insert into toast_acquisition.jobs (
    operation_key, source_key, restaurant_guid, mode, parameters,
    reason, correlation_id, idempotency_key, next_attempt_at
  )
  select detail_key, parent.source_key, parent.restaurant_guid, 'repair',
    jsonb_build_object('guid', payment.guid),
    'Payment detail discovered from archived payment list',
    parent.correlation_id,
    'toast.payment.detail:' || parent.job_id::text || ':' || lower(payment.guid),
    now() + interval '15 seconds'
  from toast_acquisition.jobs as parent
  cross join lateral (
    select min(candidate.guid) as guid
    from unnest(p_payment_guids) as candidate(guid)
    group by lower(candidate.guid)
  ) as payment
  where parent.job_id = p_parent_job_id
    and parent.capability_token = p_capability_token
    and parent.status = 'running' and parent.lease_expires_at > now()
  on conflict (idempotency_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function toast_acquisition.enqueue_payment_detail_jobs(
  bigint, uuid, text[]
) from public, anon, authenticated;
