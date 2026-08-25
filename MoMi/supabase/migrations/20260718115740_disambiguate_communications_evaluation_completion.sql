-- service-owner: communications-evaluation

create or replace function momi_communications.complete_evaluation_job_v1(
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
#variable_conflict use_column
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
