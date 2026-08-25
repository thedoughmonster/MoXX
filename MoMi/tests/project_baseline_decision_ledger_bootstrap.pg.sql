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
