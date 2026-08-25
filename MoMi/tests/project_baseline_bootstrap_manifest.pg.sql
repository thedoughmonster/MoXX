\set ON_ERROR_STOP on
begin;

\ir project_baseline_bootstrap_apply_fixture.pg.sql

do $$
begin
  if (select count(*) from momi_governance.material_decisions) <> 6 then
    raise exception 'Canonical bootstrap did not create six decisions';
  end if;
  if (select count(*) from momi_governance.decision_events) <> 12 then
    raise exception 'Canonical bootstrap did not create twelve events';
  end if;
  if (select count(*) from momi_governance.bootstrap_reconciliations) <> 1 then
    raise exception 'Canonical bootstrap did not create one reconciliation';
  end if;
  if (
    select manifest_digest
    from momi_governance.bootstrap_reconciliations
  ) <> 'd89d4c426419976631b1e411f516eea915176a6e20690d8944e7600487da8b2a'
  then
    raise exception 'Canonical bootstrap stored another manifest digest';
  end if;
  if (
    select count(*)
    from momi_governance.bootstrap_reconciliations stored
    cross join lateral jsonb_object_keys(stored.decision_mapping)
  ) <> 6
  then
    raise exception 'Canonical bootstrap mapping is incomplete';
  end if;
end;
$$;

\ir project_baseline_bootstrap_apply_fixture.pg.sql

do $$
begin
  if (select count(*) from momi_governance.material_decisions) <> 6
    or (select count(*) from momi_governance.decision_events) <> 12
    or (select count(*) from momi_governance.bootstrap_reconciliations) <> 1
  then
    raise exception 'Canonical bootstrap exact replay changed row counts';
  end if;
end;
$$;

rollback;
