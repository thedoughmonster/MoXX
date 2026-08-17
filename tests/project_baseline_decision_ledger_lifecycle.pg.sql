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
