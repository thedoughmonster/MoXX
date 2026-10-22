with inventory as (
  select coalesce(jsonb_agg(jsonb_build_object('version', m.version,
    'sha256', encode(sha256(convert_to(to_jsonb(m)::text, 'UTF8')), 'hex'))
    order by m.version), '[]'::jsonb) as ledger
  from supabase_migrations.schema_migrations m
), ownership as (
  select jsonb_build_object(
    'schema', to_regnamespace('momi_cron_history') is not null,
    'schema_owner', (select pg_get_userbyid(nspowner) from pg_namespace where nspname='momi_cron_history'),
    'schema_acl', (select nspacl from pg_namespace where nspname='momi_cron_history'),
    'relations', (select jsonb_agg(jsonb_build_object(
      'name', c.relname, 'kind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
      'acl', c.relacl, 'rls', c.relrowsecurity,
      'columns', (select jsonb_agg(jsonb_build_object('name', a.attname,
        'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
        'default', pg_get_expr(d.adbin, d.adrelid)) order by a.attnum)
        from pg_attribute a left join pg_attrdef d
        on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints', (select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname)
        from pg_constraint k where k.conrelid=c.oid),
      'indexes', (select jsonb_agg(pg_get_indexdef(i.indexrelid) order by i.indexrelid::regclass::text)
        from pg_index i where i.indrelid=c.oid)) order by c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='momi_cron_history' and c.relkind in ('r','p','S')),
    'policies', (select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)
      from pg_policies p where p.schemaname='momi_cron_history'),
    'routines', (select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'definition', pg_get_functiondef(p.oid),
      'owner', pg_get_userbyid(p.proowner), 'acl', p.proacl)
      order by p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='momi_cron_history' and p.prokind='f'),
    'triggers', (select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='momi_cron_history' and not t.tgisinternal),
    'cron', (select jsonb_agg(jsonb_build_object('jobid',jobid,'name',jobname,
      'schedule',schedule,'active',active,'command',command) order by jobid)
      from cron.job where jobname='momi-cron-history-governor-v1'),
    'dependencies', (select jsonb_object_agg(name,to_regclass(name) is not null)
      from unnest(array['cron.job_run_details','vault.decrypted_secrets',
        'pgmq.q_order_alerting_v1','pgmq.q_order_alerting_v1_dead_letter',
        'pgmq.q_warehouse_projection_toast_v1',
        'pgmq.q_warehouse_projection_toast_v1_dead_letter']) name),
    'vault_names', (select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
      from vault.secrets where name in ('momi_project_url','momi_publishable_key')),
    'metrics_routine', to_regprocedure('pgmq.metrics(text)') is not null,
    'http_routine', exists(select 1 from pg_proc p join pg_namespace n
      on n.oid=p.pronamespace where n.nspname='net' and p.proname='http_post')
  ) as objects
)
select ledger, objects,
  encode(sha256(convert_to(ledger::text,'UTF8')),'hex') as ledger_sha256,
  encode(sha256(convert_to(objects::text,'UTF8')),'hex') as objects_sha256
from inventory cross join ownership
