\set ON_ERROR_STOP on
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

\ir project_baseline_decision_ledger_lifecycle.pg.sql

\ir project_baseline_decision_ledger_bootstrap.pg.sql
\ir project_baseline_decision_ledger_security.pg.sql

rollback;
