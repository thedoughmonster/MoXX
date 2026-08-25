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
