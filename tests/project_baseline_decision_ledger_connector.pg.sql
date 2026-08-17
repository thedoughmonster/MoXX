begin;

do $$
declare
  v_first record;
  v_replay record;
  v_accepted record;
  v_history jsonb;
begin
  begin
    perform momi_governance.canonicalize_provenance_preimage_v1(null);
    raise exception 'NULL provenance preimage was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform momi_governance.canonicalize_bootstrap_entry_v1(null);
    raise exception 'NULL bootstrap entry was accepted';
  exception when invalid_parameter_value then null;
  end;

  select * into v_first from momi_governance.append_decision_event_v1(
    'receipt_fixture', 'PB-LOCAL-1',
    momi_governance.provenance_digest_v1(
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}'
    ),
    '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}',
    'governance', 'proposed', 'receipt_fixture', 'PB-LOCAL-1:proposed',
    momi_governance.provenance_digest_v1(
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:proposed"}'
    ),
    '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:proposed"}',
    'pb-local-1-proposed', 'Adopt an append-only decision ledger',
    'Governance needs immutable material history', '[]'::jsonb, '[]'::jsonb,
    'local-validator', '2026-08-17T00:00:00Z', 'disposable local PostgreSQL',
    null, jsonb_build_array(jsonb_build_object(
      'evidence_key', 'migration', 'evidence_kind', 'sql',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content', 'migration fixture'
      ), 'evidence_digest', momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"migration fixture"}'
      ), 'source_snapshot', 'local',
      'locator', 'tests/project_baseline_decision_ledger.pg.sql',
      'summary', 'Disposable transaction fixture'
    )), jsonb_build_array(jsonb_build_object(
      'reference_key', 'issue', 'reference_kind', 'linear',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content', 'MOX-168'
      ), 'reference_digest', momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"MOX-168"}'
      ), 'locator', 'MOX-168'
    ))
  );
  if not v_first.inserted then raise exception 'first event was not inserted'; end if;

  select * into v_replay from momi_governance.append_decision_event_v1(
    'receipt_fixture', 'PB-LOCAL-1',
    momi_governance.provenance_digest_v1(
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}'
    ),
    '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}',
    'governance', 'proposed', 'receipt_fixture', 'PB-LOCAL-1:proposed',
    momi_governance.provenance_digest_v1(
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:proposed"}'
    ),
    '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:proposed"}',
    'pb-local-1-proposed', 'Adopt an append-only decision ledger',
    'Governance needs immutable material history', '[]'::jsonb, '[]'::jsonb,
    'local-validator', '2026-08-17T00:00:00Z', 'disposable local PostgreSQL',
    null, jsonb_build_array(jsonb_build_object(
      'evidence_key', 'migration', 'evidence_kind', 'sql',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content', 'migration fixture'
      ), 'evidence_digest', momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"migration fixture"}'
      ), 'source_snapshot', 'local',
      'locator', 'tests/project_baseline_decision_ledger.pg.sql',
      'summary', 'Disposable transaction fixture'
    )), jsonb_build_array(jsonb_build_object(
      'reference_key', 'issue', 'reference_kind', 'linear',
      'digest_preimage', jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8', 'content', 'MOX-168'
      ), 'reference_digest', momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"MOX-168"}'
      ), 'locator', 'MOX-168'
    ))
  );
  if v_replay.inserted or v_replay.event_id <> v_first.event_id then
    raise exception 'exact replay did not return the original event';
  end if;

  begin
    perform * from momi_governance.append_decision_event_v1(
      'receipt_fixture', 'PB-LOCAL-1',
      momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}'
      ),
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}',
      'governance', 'proposed', 'receipt_fixture', 'PB-LOCAL-1:proposed',
      momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:proposed"}'
      ),
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:proposed"}',
      'pb-local-1-proposed', 'changed replay', 'must fail',
      '[]'::jsonb, '[]'::jsonb, 'local-validator',
      '2026-08-17T00:00:00Z', 'disposable local PostgreSQL'
    );
    raise exception 'changed replay was accepted';
  exception when unique_violation then null;
  end;

  select * into v_accepted from momi_governance.append_decision_event_v1(
    'receipt_fixture', 'PB-LOCAL-1',
    momi_governance.provenance_digest_v1(
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}'
    ),
    '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}',
    'governance', 'accepted', 'receipt_fixture', 'PB-LOCAL-1:accepted',
    momi_governance.provenance_digest_v1(
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:accepted"}'
    ),
    '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:accepted"}',
    'pb-local-1-accepted', 'Adopt an append-only decision ledger',
    'Fixture acceptance', '[]'::jsonb, '[]'::jsonb, 'local-validator',
    '2026-08-17T00:01:00Z', 'disposable local PostgreSQL'
  );
  if v_accepted.lifecycle_status <> 'accepted' then
    raise exception 'legal proposal-to-acceptance transition failed';
  end if;
  begin
    perform * from momi_governance.append_decision_event_v1(
      'receipt_fixture', 'PB-LOCAL-1',
      momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}'
      ),
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1"}',
      'governance', 'accepted', 'receipt_fixture',
      'PB-LOCAL-1:accepted-again', momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:accepted-again"}'
      ),
      '{"schema_version":1,"encoding":"utf-8","content":"PB-LOCAL-1:accepted-again"}',
      'pb-local-1-accepted-again', 'Illegal repeat', 'must fail',
      '[]'::jsonb, '[]'::jsonb, 'local-validator',
      '2026-08-17T00:02:00Z', 'disposable local PostgreSQL'
    );
    raise exception 'illegal lifecycle transition was accepted';
  exception when check_violation then null;
  end;

  begin
    perform * from momi_governance.append_decision_event_v1(
      'receipt_fixture', 'PB-DIGEST-MISMATCH', repeat('f', 64),
      '{"schema_version":1,"encoding":"utf-8","content":"PB-DIGEST-MISMATCH"}',
      'governance', 'proposed', 'receipt_fixture', 'PB-DIGEST-MISMATCH:proposed',
      momi_governance.provenance_digest_v1(
        '{"schema_version":1,"encoding":"utf-8","content":"PB-DIGEST-MISMATCH:proposed"}'
      ),
      '{"schema_version":1,"encoding":"utf-8","content":"PB-DIGEST-MISMATCH:proposed"}',
      'pb-digest-mismatch', 'Reject a changed expected digest',
      'Expected digests must bind exact UTF-8 content', '[]'::jsonb, '[]'::jsonb,
      'local-validator', '2026-08-17T00:03:00Z',
      'disposable local PostgreSQL'
    );
    raise exception 'changed expected digest was accepted';
  exception when check_violation then null;
  end;

  v_history := momi_governance.read_decision_history_v1(v_first.decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'accepted'
    or jsonb_array_length(v_history->'history') <> 2
    or jsonb_array_length(v_history #> '{history,0,evidence}') <> 1
    or jsonb_array_length(v_history #> '{history,0,external_references}') <> 1
    or v_history #>> '{identity,source_identity_preimage,content}' <> 'PB-LOCAL-1'
    or v_history #>> '{history,0,canonical_document,event_source_preimage,content}'
      <> 'PB-LOCAL-1:proposed'
    or v_history #>> '{history,0,evidence,0,digest_preimage,content}'
      <> 'migration fixture'
    or v_history
      #>> '{history,0,external_references,0,digest_preimage,content}'
      <> 'MOX-168'
    or v_history #>> '{identity,source_identity_digest}' <>
      momi_governance.provenance_digest_v1(
        v_history #> '{identity,source_identity_preimage}'
      )
    or v_history #>> '{history,0,canonical_document,event_source_digest}' <>
      momi_governance.provenance_digest_v1(
        v_history #> '{history,0,canonical_document,event_source_preimage}'
      )
    or v_history #>> '{history,0,evidence,0,evidence_digest}' <>
      momi_governance.provenance_digest_v1(
        v_history #> '{history,0,evidence,0,digest_preimage}'
      )
    or v_history
      #>> '{history,0,external_references,0,reference_digest}' <>
      momi_governance.provenance_digest_v1(
        v_history
          #> '{history,0,external_references,0,digest_preimage}'
      )
  then raise exception 'history projection or linked records are incomplete';
  end if;
end;
$$;

create function pg_temp.append_pb_lifecycle(
  p_decision text,
  p_status text,
  p_event text,
  p_idempotency text,
  p_related uuid default null
) returns table (
  decision_id uuid,
  event_id uuid,
  decision_version integer,
  lifecycle_status text,
  content_digest text,
  recorded_at timestamptz,
  inserted boolean
) language sql security invoker as $$
  select * from momi_governance.append_decision_event_v1(
    'receipt_lifecycle', p_decision,
    momi_governance.provenance_digest_v1(jsonb_build_object(
      'schema_version', 1, 'encoding', 'utf-8', 'content', p_decision
    )),
    jsonb_build_object(
      'schema_version', 1, 'encoding', 'utf-8', 'content', p_decision
    ),
    'governance', p_status, 'receipt_lifecycle', p_event,
    momi_governance.provenance_digest_v1(jsonb_build_object(
      'schema_version', 1, 'encoding', 'utf-8', 'content', p_event
    )),
    jsonb_build_object(
      'schema_version', 1, 'encoding', 'utf-8', 'content', p_event
    ),
    p_idempotency, 'Lifecycle decision ' || p_decision,
    'Rollback-only lifecycle fixture', '[]'::jsonb, '[]'::jsonb,
    'local-validator', '2026-08-17T00:10:00Z',
    'disposable local PostgreSQL', p_related
  );
$$;

do $$
declare
  v_event record;
  v_new record;
  v_old record;
  v_target record;
  v_history jsonb;
begin
  perform * from pg_temp.append_pb_lifecycle(
    'PB-REJECT', 'proposed', 'PB-REJECT:proposed', 'pb-reject-proposed'
  );
  select * into v_event from pg_temp.append_pb_lifecycle(
    'PB-REJECT', 'rejected', 'PB-REJECT:rejected', 'pb-reject-rejected'
  );
  v_history := momi_governance.read_decision_history_v1(v_event.decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'rejected' then
    raise exception 'rejected projection is incorrect';
  end if;
  begin
    perform * from pg_temp.append_pb_lifecycle(
      'PB-REJECT', 'accepted', 'PB-REJECT:accepted-late', 'pb-reject-late'
    );
    raise exception 'rejected decision accepted a later event';
  exception when check_violation then null;
  end;

  perform * from pg_temp.append_pb_lifecycle(
    'PB-REVOKE', 'proposed', 'PB-REVOKE:proposed', 'pb-revoke-proposed'
  );
  perform * from pg_temp.append_pb_lifecycle(
    'PB-REVOKE', 'accepted', 'PB-REVOKE:accepted', 'pb-revoke-accepted'
  );
  select * into v_event from pg_temp.append_pb_lifecycle(
    'PB-REVOKE', 'revoked', 'PB-REVOKE:revoked', 'pb-revoke-revoked'
  );
  v_history := momi_governance.read_decision_history_v1(v_event.decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'revoked' then
    raise exception 'revoked projection is incorrect';
  end if;
  begin
    perform * from pg_temp.append_pb_lifecycle(
      'PB-REVOKE', 'revoked', 'PB-REVOKE:again', 'pb-revoke-again'
    );
    raise exception 'revoked decision accepted a later event';
  exception when check_violation then null;
  end;

  perform * from pg_temp.append_pb_lifecycle(
    'PB-NEW', 'proposed', 'PB-NEW:proposed', 'pb-new-proposed'
  );
  select * into v_new from pg_temp.append_pb_lifecycle(
    'PB-NEW', 'accepted', 'PB-NEW:accepted', 'pb-new-accepted'
  );
  perform * from pg_temp.append_pb_lifecycle(
    'PB-OLD', 'proposed', 'PB-OLD:proposed', 'pb-old-proposed'
  );
  perform * from pg_temp.append_pb_lifecycle(
    'PB-OLD', 'accepted', 'PB-OLD:accepted', 'pb-old-accepted'
  );
  select * into v_old from pg_temp.append_pb_lifecycle(
    'PB-OLD', 'superseded', 'PB-OLD:superseded', 'pb-old-superseded',
    v_new.decision_id
  );
  v_history := momi_governance.read_decision_history_v1(v_old.decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'superseded'
    or v_history #>> '{current_projection,canonical_document,related_decision_id}'
      <> v_new.decision_id::text
  then raise exception 'superseded projection or relation is incorrect';
  end if;
  begin
    perform * from pg_temp.append_pb_lifecycle(
      'PB-OLD', 'revoked', 'PB-OLD:revoked-late', 'pb-old-late'
    );
    raise exception 'superseded decision accepted a later event';
  exception when check_violation then null;
  end;

  select * into v_target from pg_temp.append_pb_lifecycle(
    'PB-PROPOSED-TARGET', 'proposed',
    'PB-PROPOSED-TARGET:proposed', 'pb-proposed-target'
  );
  perform * from pg_temp.append_pb_lifecycle(
    'PB-OLD-2', 'proposed', 'PB-OLD-2:proposed', 'pb-old-2-proposed'
  );
  perform * from pg_temp.append_pb_lifecycle(
    'PB-OLD-2', 'accepted', 'PB-OLD-2:accepted', 'pb-old-2-accepted'
  );
  begin
    perform * from pg_temp.append_pb_lifecycle(
      'PB-OLD-2', 'superseded', 'PB-OLD-2:superseded',
      'pb-old-2-superseded', v_target.decision_id
    );
    raise exception 'unaccepted superseding target was accepted';
  exception when check_violation then null;
  end;

  perform * from pg_temp.append_pb_lifecycle(
    'PB-COLLIDE-A', 'proposed', 'PB-COLLIDE-A:event', 'pb-collide-a'
  );
  perform * from pg_temp.append_pb_lifecycle(
    'PB-COLLIDE-B', 'proposed', 'PB-COLLIDE-B:event', 'pb-collide-b'
  );
  begin
    perform * from pg_temp.append_pb_lifecycle(
      'PB-COLLIDE-A', 'proposed', 'PB-COLLIDE-A:event', 'pb-collide-b'
    );
    raise exception 'source/idempotency split collision was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

do $$
declare
  v_entry_1 jsonb;
  v_entry_2 jsonb;
  v_entries jsonb;
  v_changed jsonb;
  v_digest text;
  v_manifest text;
  v_result jsonb;
begin
  v_entry_1 := jsonb_build_object(
    'schema_version', 1, 'temporary_id', 'TMP-PB-1', 'category', 'governance',
    'decision', 'Bootstrap the permanent ledger', 'rationale', 'One-time move',
    'alternatives', '[]'::jsonb, 'consequences', '[]'::jsonb,
    'decided_by', 'local-validator',
    'decided_at', momi_governance.canonical_timestamp_v1('2026-08-17Z'),
    'source_snapshot', 'disposable local PostgreSQL',
    'supersedes_temporary_id', null, 'evidence', '[]'::jsonb,
    'external_references', '[]'::jsonb
  );
  v_entry_1 := momi_governance.canonicalize_bootstrap_entry_v1(v_entry_1);
  v_digest := encode(extensions.digest(
    convert_to(v_entry_1::text, 'UTF8'), 'sha256'), 'hex');
  v_entry_1 := v_entry_1 || jsonb_build_object('temporary_digest', v_digest);
  v_entry_2 := v_entry_1 || jsonb_build_object(
    'temporary_id', 'TMP-PB-2', 'decision', 'Preserve ordered bootstrap input'
  );
  v_entry_2 := v_entry_2 - 'temporary_digest';
  v_entry_2 := momi_governance.canonicalize_bootstrap_entry_v1(v_entry_2);
  v_digest := encode(extensions.digest(
    convert_to(v_entry_2::text, 'UTF8'), 'sha256'), 'hex');
  v_entry_2 := v_entry_2 || jsonb_build_object('temporary_digest', v_digest);
  v_entries := jsonb_build_array(v_entry_1, v_entry_2);
  v_manifest := encode(extensions.digest(convert_to(jsonb_build_object(
    'schema_version', 1, 'entries', v_entries
  )::text, 'UTF8'), 'sha256'), 'hex');
  begin
    perform momi_governance.reconcile_bootstrap_v1(
      'another-bootstrap', v_manifest, v_entries, 'local-validator'
    );
    raise exception 'a second bootstrap identity was accepted';
  exception when invalid_parameter_value then null;
  end;
  v_result := momi_governance.reconcile_bootstrap_v1(
    'project-baseline-pre-ledger-v1', v_manifest, v_entries, 'local-validator'
  );
  if (v_result->>'replayed')::boolean then raise exception 'first bootstrap replayed'; end if;
  v_result := momi_governance.reconcile_bootstrap_v1(
    'project-baseline-pre-ledger-v1', v_manifest, v_entries, 'local-validator'
  );
  if not (v_result->>'replayed')::boolean then raise exception 'bootstrap replay failed'; end if;

  v_changed := jsonb_set(v_entry_1, '{decision}', '"changed"'::jsonb);
  begin
    perform momi_governance.reconcile_bootstrap_v1(
      'project-baseline-pre-ledger-v1', v_manifest,
      jsonb_build_array(v_changed, v_entry_2), 'local-validator'
    );
    raise exception 'changed bootstrap entry digest was accepted';
  exception when check_violation then null;
  end;
  begin
    perform momi_governance.reconcile_bootstrap_v1(
      'project-baseline-pre-ledger-v1',
      repeat('f', 64), v_entries, 'local-validator'
    );
    raise exception 'changed bootstrap manifest was accepted';
  exception when check_violation then null;
  end;
  begin
    perform momi_governance.reconcile_bootstrap_v1(
      'project-baseline-pre-ledger-v1', v_manifest,
      jsonb_build_array(v_entry_2, v_entry_1), 'local-validator'
    );
    raise exception 'reordered bootstrap manifest was accepted';
  exception when check_violation then null;
  end;
end;
$$;

do $$
declare
  v_role text;
  v_table text;
  v_routine oid;
  v_count integer;
  v_timestamp_column text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if has_schema_privilege(v_role, 'momi_governance', 'USAGE')
      or has_schema_privilege(v_role, 'momi_governance', 'CREATE')
    then raise exception '% has governance schema access', v_role;
    end if;
    for v_table in
      select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'momi_governance' and c.relkind = 'r'
    loop
      if has_table_privilege(v_role, format('momi_governance.%I', v_table), 'SELECT')
        or has_table_privilege(v_role, format('momi_governance.%I', v_table), 'INSERT')
        or has_table_privilege(v_role, format('momi_governance.%I', v_table), 'UPDATE')
        or has_table_privilege(v_role, format('momi_governance.%I', v_table), 'DELETE')
        or has_table_privilege(v_role, format('momi_governance.%I', v_table), 'TRUNCATE')
      then raise exception '% has access to %', v_role, v_table;
      end if;
    end loop;
    for v_routine in
      select p.oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'momi_governance'
    loop
      if has_function_privilege(v_role, v_routine, 'EXECUTE') then
        raise exception '% can execute governance routine %', v_role, v_routine;
      end if;
    end loop;
  end loop;

  select count(*) into v_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'momi_governance' and c.relkind = 'r'
    and c.relrowsecurity and c.relforcerowsecurity;
  if v_count <> 5 then raise exception 'not all five tables force RLS'; end if;
  if exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'momi_governance'
  ) then raise exception 'governance schema unexpectedly has RLS policies';
  end if;
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'momi_governance'
    and p.proname in (
      'append_decision_event_v1', 'read_decision_history_v1',
      'reconcile_bootstrap_v1'
    ) and has_function_privilege('postgres', p.oid, 'EXECUTE');
  if v_count <> 3 then raise exception 'trusted postgres operator cannot execute'; end if;

  foreach v_table in array array['material_decisions', 'decision_events',
    'decision_evidence', 'decision_external_references', 'bootstrap_reconciliations']
  loop
    v_timestamp_column := case when v_table = 'bootstrap_reconciliations'
      then 'reconciled_at' else 'recorded_at' end;
    begin
      execute format('update momi_governance.%I set %I = %I',
        v_table, v_timestamp_column, v_timestamp_column);
      raise exception 'update accepted for %', v_table;
    exception when sqlstate '55000' then null;
    end;
    begin
      execute format('delete from momi_governance.%I', v_table);
      raise exception 'delete accepted for %', v_table;
    exception when sqlstate '55000' then null;
    end;
    begin
      execute format('truncate momi_governance.%I cascade', v_table);
      raise exception 'truncate accepted for %', v_table;
    exception when sqlstate '55000' then null;
    end;
  end loop;
end;
$$;

rollback;
