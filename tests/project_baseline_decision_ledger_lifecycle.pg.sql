do $$
declare
  v_fixture jsonb;
  v_event record;
  v_new_decision_id uuid;
  v_old_decision_id uuid;
  v_rejected_decision_id uuid;
  v_revoked_decision_id uuid;
  v_target_decision_id uuid;
  v_history jsonb;
begin
  for v_fixture in
    select value from jsonb_array_elements($fixtures$[
      {"decision":"PB-REJECT","status":"proposed","event":"PB-REJECT:proposed","idempotency":"pb-reject-proposed"},
      {"decision":"PB-REJECT","status":"rejected","event":"PB-REJECT:rejected","idempotency":"pb-reject-rejected"},
      {"decision":"PB-REVOKE","status":"proposed","event":"PB-REVOKE:proposed","idempotency":"pb-revoke-proposed"},
      {"decision":"PB-REVOKE","status":"accepted","event":"PB-REVOKE:accepted","idempotency":"pb-revoke-accepted"},
      {"decision":"PB-REVOKE","status":"revoked","event":"PB-REVOKE:revoked","idempotency":"pb-revoke-revoked"},
      {"decision":"PB-NEW","status":"proposed","event":"PB-NEW:proposed","idempotency":"pb-new-proposed"},
      {"decision":"PB-NEW","status":"accepted","event":"PB-NEW:accepted","idempotency":"pb-new-accepted"},
      {"decision":"PB-OLD","status":"proposed","event":"PB-OLD:proposed","idempotency":"pb-old-proposed"},
      {"decision":"PB-OLD","status":"accepted","event":"PB-OLD:accepted","idempotency":"pb-old-accepted"},
      {"decision":"PB-OLD","status":"superseded","event":"PB-OLD:superseded","idempotency":"pb-old-superseded"},
      {"decision":"PB-PROPOSED-TARGET","status":"proposed","event":"PB-PROPOSED-TARGET:proposed","idempotency":"pb-proposed-target"},
      {"decision":"PB-OLD-2","status":"proposed","event":"PB-OLD-2:proposed","idempotency":"pb-old-2-proposed"},
      {"decision":"PB-OLD-2","status":"accepted","event":"PB-OLD-2:accepted","idempotency":"pb-old-2-accepted"},
      {"decision":"PB-COLLIDE-A","status":"proposed","event":"PB-COLLIDE-A:event","idempotency":"pb-collide-a"},
      {"decision":"PB-COLLIDE-B","status":"proposed","event":"PB-COLLIDE-B:event","idempotency":"pb-collide-b"}
    ]$fixtures$::jsonb)
  loop
    select * into v_event from momi_governance.append_decision_event_v1(
      'receipt_lifecycle', v_fixture->>'decision',
      momi_governance.provenance_digest_v1(jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8',
        'content', v_fixture->>'decision'
      )),
      jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8',
        'content', v_fixture->>'decision'
      ),
      'governance', v_fixture->>'status',
      'receipt_lifecycle', v_fixture->>'event',
      momi_governance.provenance_digest_v1(jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8',
        'content', v_fixture->>'event'
      )),
      jsonb_build_object(
        'schema_version', 1, 'encoding', 'utf-8',
        'content', v_fixture->>'event'
      ),
      v_fixture->>'idempotency',
      'Lifecycle decision ' || (v_fixture->>'decision'),
      'Rollback-only lifecycle fixture', '[]'::jsonb, '[]'::jsonb,
      'local-validator', '2026-08-17T00:10:00Z',
      'disposable local PostgreSQL',
      case when v_fixture->>'event' = 'PB-OLD:superseded'
        then v_new_decision_id else null end
    );

    case v_fixture->>'event'
      when 'PB-REJECT:rejected' then
        v_rejected_decision_id := v_event.decision_id;
      when 'PB-REVOKE:revoked' then
        v_revoked_decision_id := v_event.decision_id;
      when 'PB-NEW:accepted' then
        v_new_decision_id := v_event.decision_id;
      when 'PB-OLD:superseded' then
        v_old_decision_id := v_event.decision_id;
      when 'PB-PROPOSED-TARGET:proposed' then
        v_target_decision_id := v_event.decision_id;
      else null;
    end case;
  end loop;

  v_history := momi_governance.read_decision_history_v1(v_rejected_decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'rejected' then
    raise exception 'rejected projection is incorrect';
  end if;

  v_history := momi_governance.read_decision_history_v1(v_revoked_decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'revoked' then
    raise exception 'revoked projection is incorrect';
  end if;

  v_history := momi_governance.read_decision_history_v1(v_old_decision_id);
  if v_history #>> '{current_projection,lifecycle_status}' <> 'superseded'
    or v_history #>> '{current_projection,canonical_document,related_decision_id}'
      <> v_new_decision_id::text
  then raise exception 'superseded projection or relation is incorrect';
  end if;

  for v_fixture in
    select value from jsonb_array_elements($failures$[
      {"decision":"PB-REJECT","status":"accepted","event":"PB-REJECT:accepted-late","idempotency":"pb-reject-late","expected":"check_violation","message":"rejected decision accepted a later event"},
      {"decision":"PB-REVOKE","status":"revoked","event":"PB-REVOKE:again","idempotency":"pb-revoke-again","expected":"check_violation","message":"revoked decision accepted a later event"},
      {"decision":"PB-OLD","status":"revoked","event":"PB-OLD:revoked-late","idempotency":"pb-old-late","expected":"check_violation","message":"superseded decision accepted a later event"},
      {"decision":"PB-OLD-2","status":"superseded","event":"PB-OLD-2:superseded","idempotency":"pb-old-2-superseded","related":"proposed-target","expected":"check_violation","message":"unaccepted superseding target was accepted"},
      {"decision":"PB-COLLIDE-A","status":"proposed","event":"PB-COLLIDE-A:event","idempotency":"pb-collide-b","expected":"unique_violation","message":"source/idempotency split collision was accepted"}
    ]$failures$::jsonb)
  loop
    begin
      perform * from momi_governance.append_decision_event_v1(
        'receipt_lifecycle', v_fixture->>'decision',
        momi_governance.provenance_digest_v1(jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', v_fixture->>'decision'
        )),
        jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', v_fixture->>'decision'
        ),
        'governance', v_fixture->>'status',
        'receipt_lifecycle', v_fixture->>'event',
        momi_governance.provenance_digest_v1(jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', v_fixture->>'event'
        )),
        jsonb_build_object(
          'schema_version', 1, 'encoding', 'utf-8',
          'content', v_fixture->>'event'
        ),
        v_fixture->>'idempotency',
        'Lifecycle decision ' || (v_fixture->>'decision'),
        'Rollback-only lifecycle fixture', '[]'::jsonb, '[]'::jsonb,
        'local-validator', '2026-08-17T00:10:00Z',
        'disposable local PostgreSQL',
        case when v_fixture->>'related' = 'proposed-target'
          then v_target_decision_id else null end
      );
      raise exception '%', v_fixture->>'message';
    exception
      when check_violation then
        if v_fixture->>'expected' <> 'check_violation' then raise; end if;
      when unique_violation then
        if v_fixture->>'expected' <> 'unique_violation' then raise; end if;
    end;
  end loop;
end;
$$;
