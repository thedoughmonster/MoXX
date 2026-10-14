-- Immediate bootstrap verification, run as the same approved object owner.
-- Catalog/data reads only; failures abort the caller's transaction.
do $$
declare
  expected_tables text[] := array['invoice_policy_versions', 'invoice_standing_order_versions',
    'invoice_standing_orders', 'invoice_version_weekday_lines', 'invoice_weekly_snapshot_lines',
    'invoice_weekly_snapshots', 'invoice_weeks'];
  actual_tables text[];
  expected_functions text[] := array[
    'bridge.invoice_validate_standing_order_v1(jsonb,jsonb)',
    'bridge.invoice_save_standing_order_v1(uuid,integer,jsonb,jsonb)',
    'bridge.invoice_preview_week_v1(uuid,date)',
    'bridge.invoice_calendar_version_guard_v1()',
    'bridge.invoice_save_standing_order_v2(uuid,integer,jsonb,jsonb,jsonb)',
    'bridge.invoice_calendar_snapshot_v1(text,text,text)'];
begin
  select array_agg(c.relname::text order by c.relname) into actual_tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'bridge' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S');
  if actual_tables is distinct from expected_tables then
    raise exception 'invoice_bootstrap_unexpected_relation_inventory';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge') <> 6
    or exists (select 1 from unnest(expected_functions) f where to_regprocedure(f) is null) then
    raise exception 'invoice_bootstrap_unexpected_routine_inventory';
  end if;
  if exists (select 1 from pg_roles where rolname = 'svc_wholesale_invoicing') then
    raise exception 'invoice_bootstrap_runtime_role_must_remain_deferred';
  end if;
  if exists (select 1 from pg_namespace n where n.nspname = 'bridge'
      and n.nspowner <> current_user::regrole::oid)
    or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'bridge' and c.relowner <> current_user::regrole::oid)
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge' and p.proowner <> current_user::regrole::oid) then
    raise exception 'invoice_bootstrap_unexpected_object_owner';
  end if;
  if exists (select 1 from pg_namespace n,
      lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
      where n.nspname = 'bridge' and a.grantee <> n.nspowner)
    or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace,
      lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where n.nspname = 'bridge' and c.relkind = 'r' and a.grantee <> c.relowner)
    or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'bridge' and a.grantee <> p.proowner)
    or exists (select 1 from pg_attribute t join pg_class c on c.oid = t.attrelid
      join pg_namespace n on n.oid = c.relnamespace, lateral aclexplode(t.attacl) a
      where n.nspname = 'bridge' and a.grantee <> c.relowner) then
    raise exception 'invoice_bootstrap_unexpected_delegated_access';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'bridge' and c.relkind = 'r' and not c.relrowsecurity)
    or exists (select 1 from pg_policies where schemaname = 'bridge') then
    raise exception 'invoice_bootstrap_unexpected_rls';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge' and p.proconfig is distinct from array['search_path=""'])
    or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'bridge' and p.prosecdef) <> 4 then
    raise exception 'invoice_bootstrap_unexpected_routine_security';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'bridge'
      and table_name = 'invoice_standing_order_versions' and column_name = 'calendar_metadata'
      and data_type = 'jsonb' and is_nullable = 'YES')
    or (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'bridge' and not t.tgisinternal) <> 1
    or not exists (select 1 from pg_trigger where tgname = 'invoice_calendar_version_guard'
      and tgrelid = 'bridge.invoice_standing_order_versions'::regclass
      and tgfoid = 'bridge.invoice_calendar_version_guard_v1()'::regprocedure
      and tgenabled = 'O' and tgtype = 31) then
    raise exception 'invoice_bootstrap_calendar_contract_missing';
  end if;
  if (select count(*) from bridge.invoice_policy_versions) <> 1
    or not exists (select 1 from bridge.invoice_policy_versions where policy_version = 1
      and enabled = false and timezone = 'America/New_York' and basis = 'standing_order' and tax_exempt)
    or exists (select 1 from bridge.invoice_standing_orders)
    or exists (select 1 from bridge.invoice_standing_order_versions)
    or exists (select 1 from bridge.invoice_version_weekday_lines)
    or exists (select 1 from bridge.invoice_weeks)
    or exists (select 1 from bridge.invoice_weekly_snapshots)
    or exists (select 1 from bridge.invoice_weekly_snapshot_lines) then
    raise exception 'invoice_bootstrap_unexpected_business_rows_or_policy';
  end if;
end;
$$;

select 'owner_only_bootstrap_verified' as result, 7 as tables, 6 as routines,
  1 as revision_guard, false as runtime_access_granted, false as sending_enabled;
