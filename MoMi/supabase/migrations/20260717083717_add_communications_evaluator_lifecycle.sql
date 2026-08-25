-- service-owner: communications-archive

alter table momi_communications.evaluation_jobs
  add column next_attempt_at timestamptz,
  add column lease_expires_at timestamptz;

update momi_communications.evaluation_jobs
set next_attempt_at = queued_at
where next_attempt_at is null;

alter table momi_communications.evaluation_jobs
  alter column next_attempt_at set default now(),
  alter column next_attempt_at set not null,
  drop constraint evaluation_jobs_status_valid,
  add constraint evaluation_jobs_status_valid check (
    job_status in ('pending', 'claimed', 'completed', 'failed', 'dead_letter')
  );

drop index momi_communications.evaluation_jobs_claim_idx;

create index evaluation_jobs_due_idx
  on momi_communications.evaluation_jobs (next_attempt_at, evaluation_job_id)
  where job_status in ('pending', 'claimed', 'failed');

create unique index communication_evaluations_job_unique
  on momi_communications.communication_evaluations (evaluation_job_id)
  where evaluation_job_id is not null;

alter table momi_communications.derived_records
  add column evaluation_id bigint
    references momi_communications.communication_evaluations(evaluation_id);

create index derived_records_evaluation_idx
  on momi_communications.derived_records (evaluation_id)
  where evaluation_id is not null;

create unique index derived_records_evaluation_key_unique
  on momi_communications.derived_records (evaluation_id, derived_key)
  where evaluation_id is not null;

create function momi_communications.claim_evaluation_job_v1(
  p_evaluation_job_id bigint,
  p_capability_token uuid
)
returns table (
  evaluation_job_id text,
  capability_token uuid,
  archive_item_id uuid,
  source_type text,
  source_account_key text,
  source_user_key text,
  source_conversation_key text,
  source_message_key text,
  sender_role text,
  occurred_at timestamptz,
  source_metadata jsonb,
  payload jsonb,
  raw_text text,
  attempt_count integer
)
language sql
security invoker
set search_path = ''
as $$
  with claimed as (
    update momi_communications.evaluation_jobs as job
    set job_status = 'claimed',
        claimed_at = now(),
        lease_expires_at = now() + interval '5 minutes',
        attempt_count = job.attempt_count + 1,
        last_error_code = null,
        last_error_message = null
    where job.evaluation_job_id = p_evaluation_job_id
      and job.capability_token = p_capability_token
      and job.attempt_count < 5
      and job.next_attempt_at <= now()
      and (
        job.job_status in ('pending', 'failed')
        or (job.job_status = 'claimed' and job.lease_expires_at <= now())
      )
    returning job.*
  ), audited as (
    insert into momi_communications.audit_events (
      archive_item_id, actor_key, action_key, source_account_id,
      tool_version, event_metadata
    )
    select claimed.archive_item_id, 'communications-evaluator',
      'communications.evaluation.claimed', item.source_account_id,
      'momi.communications.evaluate_item.v1',
      jsonb_build_object(
        'evaluation_job_id', claimed.evaluation_job_id,
        'attempt_count', claimed.attempt_count
      )
    from claimed
    join momi_communications.archive_items as item
      on item.archive_item_id = claimed.archive_item_id
    returning audit_event_id
  )
  select claimed.evaluation_job_id::text, claimed.capability_token,
    item.archive_item_id, item.source_type, item.source_account_key,
    item.source_user_key, item.source_conversation_key,
    item.source_message_key, item.sender_role, item.occurred_at,
    item.source_metadata, item.payload, item.raw_text,
    claimed.attempt_count
  from claimed
  join momi_communications.archive_items as item
    on item.archive_item_id = claimed.archive_item_id
  cross join audited;
$$;

create function momi_communications.complete_evaluation_job_v1(
  p_evaluation_job_id bigint,
  p_capability_token uuid,
  p_evaluator_key text,
  p_classifier_version text,
  p_model_version text,
  p_prompt_version text,
  p_result jsonb
)
returns table (evaluation_id bigint, derived_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target momi_communications.evaluation_jobs%rowtype;
  result_evaluation_id bigint;
  result_derived_count integer;
begin
  if jsonb_typeof(p_result) <> 'object'
    or nullif(p_evaluator_key, '') is null
    or nullif(p_classifier_version, '') is null
    or nullif(p_model_version, '') is null
    or nullif(p_prompt_version, '') is null
    or not (p_result ?& array[
      'decision', 'validation', 'urgency', 'impact', 'confidence',
      'rationale', 'flags', 'merge_suggestions', 'derived_records'
    ])
    or p_result->>'decision' not in (
      'retain', 'archive', 'noise', 'merge_review', 'needs_human_review'
    )
    or p_result->>'validation' not in (
      'supported', 'uncertain', 'conflicted', 'not_verifiable'
    )
    or p_result->>'urgency' not in ('none', 'low', 'medium', 'high', 'critical')
    or p_result->>'impact' not in ('low', 'medium', 'high')
    or jsonb_typeof(p_result->'confidence') <> 'number'
    or (p_result->>'confidence')::numeric not between 0 and 1
    or jsonb_typeof(p_result->'flags') <> 'array'
    or jsonb_typeof(p_result->'merge_suggestions') <> 'array'
    or jsonb_typeof(p_result->'derived_records') <> 'array'
  then raise exception 'Evaluation result is invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_result->'derived_records') as derived(record)
    where jsonb_typeof(derived.record) <> 'object'
      or not (derived.record ?& array[
        'kind', 'key', 'summary', 'details', 'work_scope',
        'destination_hint', 'confidence'
      ])
      or derived.record->>'kind' not in (
        'task', 'knowledge', 'incident', 'alert', 'other'
      )
      or nullif(derived.record->>'summary', '') is null
      or derived.record->>'work_scope' not in (
        'software_repository', 'business_operations', 'personal', 'unknown'
      )
      or derived.record->>'destination_hint' not in (
        'github_issue', 'clickup', 'none', 'undetermined'
      )
      or jsonb_typeof(derived.record->'confidence') <> 'number'
      or (derived.record->>'confidence')::numeric not between 0 and 1
  ) then raise exception 'Derived evaluation record is invalid' using errcode = '22023';
  end if;

  select job.* into target
  from momi_communications.evaluation_jobs as job
  where job.evaluation_job_id = p_evaluation_job_id
    and job.capability_token = p_capability_token
  for update;
  if not found then return; end if;

  if target.job_status = 'completed' then
    select evaluation.evaluation_id into result_evaluation_id
    from momi_communications.communication_evaluations as evaluation
    where evaluation.evaluation_job_id = p_evaluation_job_id;
    select count(*)::integer into result_derived_count
    from momi_communications.derived_records as record
    where record.evaluation_id = result_evaluation_id;
    return query select result_evaluation_id, result_derived_count;
    return;
  end if;

  if target.job_status <> 'claimed' or target.lease_expires_at <= now() then
    return;
  end if;

  insert into momi_communications.communication_evaluations (
    archive_item_id, evaluation_job_id, evaluator_key, classifier_version,
    urgency, impact, confidence, decision, flags, merge_suggestions, output
  ) values (
    target.archive_item_id, p_evaluation_job_id, p_evaluator_key,
    p_classifier_version, p_result->>'urgency', p_result->>'impact',
    (p_result->>'confidence')::numeric, p_result->>'decision',
    p_result->'flags', p_result->'merge_suggestions', p_result
  ) on conflict (evaluation_job_id) where evaluation_job_id is not null
    do nothing
  returning communication_evaluations.evaluation_id into result_evaluation_id;

  if result_evaluation_id is null then
    select evaluation.evaluation_id into result_evaluation_id
    from momi_communications.communication_evaluations as evaluation
    where evaluation.evaluation_job_id = p_evaluation_job_id;
  end if;

  insert into momi_communications.derived_records (
    archive_item_id, evaluation_id, derived_kind, derived_key,
    payload, created_by
  )
  select target.archive_item_id, result_evaluation_id, record->>'kind',
    'evaluation:' || p_evaluation_job_id::text || ':' || ordinality::text,
    record - 'kind', p_evaluator_key
  from jsonb_array_elements(p_result->'derived_records')
    with ordinality as derived(record, ordinality)
  on conflict (evaluation_id, derived_key) where evaluation_id is not null
    do nothing;

  select count(*)::integer into result_derived_count
  from momi_communications.derived_records as record
  where record.evaluation_id = result_evaluation_id;

  update momi_communications.evaluation_jobs
  set job_status = 'completed', completed_at = now(), lease_expires_at = null,
      last_error_code = null, last_error_message = null
  where evaluation_job_id = p_evaluation_job_id;

  insert into momi_communications.audit_events (
    archive_item_id, actor_key, action_key, model_version, tool_version,
    prompt_version, event_metadata
  ) values (
    target.archive_item_id, p_evaluator_key, 'communications.evaluation.completed',
    p_model_version, p_classifier_version, p_prompt_version,
    jsonb_build_object(
      'evaluation_job_id', p_evaluation_job_id,
      'evaluation_id', result_evaluation_id,
      'derived_count', result_derived_count,
      'decision', p_result->>'decision',
      'validation', p_result->>'validation'
    )
  );

  return query select result_evaluation_id, result_derived_count;
end;
$$;

create function momi_communications.fail_evaluation_job_v1(
  p_evaluation_job_id bigint,
  p_capability_token uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target momi_communications.evaluation_jobs%rowtype;
  next_status text;
begin
  if nullif(p_error_code, '') is null then
    raise exception 'Evaluation error code is required' using errcode = '22023';
  end if;

  select job.* into target
  from momi_communications.evaluation_jobs as job
  where job.evaluation_job_id = p_evaluation_job_id
    and job.capability_token = p_capability_token
    and job.job_status = 'claimed'
  for update;
  if not found then return false; end if;

  next_status := case when target.attempt_count >= 5
    then 'dead_letter' else 'failed' end;
  update momi_communications.evaluation_jobs
  set job_status = next_status,
      next_attempt_at = now() + make_interval(
        secs => least(1800, 30 * power(2, greatest(0, target.attempt_count - 1))::integer)
      ),
      lease_expires_at = null,
      last_error_code = left(p_error_code, 120),
      last_error_message = left(coalesce(p_error_message, 'evaluation failed'), 2000)
  where evaluation_job_id = p_evaluation_job_id;

  insert into momi_communications.audit_events (
    archive_item_id, actor_key, action_key, tool_version, event_metadata
  ) values (
    target.archive_item_id, 'communications-evaluator',
    'communications.evaluation.failed', 'momi.communications.evaluate_item.v1',
    jsonb_build_object(
      'evaluation_job_id', p_evaluation_job_id,
      'attempt_count', target.attempt_count,
      'error_code', left(p_error_code, 120),
      'next_status', next_status
    )
  );
  return true;
end;
$$;

revoke all on function momi_communications.claim_evaluation_job_v1(bigint, uuid)
  from public, anon, authenticated;
revoke all on function momi_communications.complete_evaluation_job_v1(
  bigint, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function momi_communications.fail_evaluation_job_v1(
  bigint, uuid, text, text
) from public, anon, authenticated;

grant execute on function momi_communications.claim_evaluation_job_v1(bigint, uuid)
  to service_role;
grant execute on function momi_communications.complete_evaluation_job_v1(
  bigint, uuid, text, text, text, text, jsonb
) to service_role;
grant execute on function momi_communications.fail_evaluation_job_v1(
  bigint, uuid, text, text
) to service_role;

comment on function momi_communications.claim_evaluation_job_v1(bigint, uuid) is
  'Claims one exact evaluator job and returns its immutable archive candidate.';
comment on function momi_communications.complete_evaluation_job_v1(
  bigint, uuid, text, text, text, text, jsonb
) is 'Atomically appends evaluator outputs and completes one leased job.';
