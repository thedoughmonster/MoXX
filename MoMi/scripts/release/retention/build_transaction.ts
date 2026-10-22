import type { RetentionApproval } from "./types.ts"

export function buildRetentionTransaction(
  approval: RetentionApproval,
  sources: { version: string; name: string; sql: string }[],
  snapshot: string,
): string {
  const additions = sources.map(({ version, name, sql }) => {
    const tag = `$retention_source_${version}$`
    if (!/^\d{14}$/.test(version) || !/^[a-z0-9_]+$/.test(name) || sql.includes(tag)) {
      throw new Error("Unsafe migration source identity")
    }
    return `${sql}\ninsert into supabase_migrations.schema_migrations
      (version,name,statements) values ('${version}','${name}',array[${tag}${sql}${tag}]);`
  }).join("\n")
  if (JSON.stringify(sources.map((source) => source.version)) !==
      JSON.stringify(approval.migrations)) throw new Error("Migration scope differs")
  return `begin;
set local statement_timeout='10000ms';
set local lock_timeout='250ms';
set local idle_in_transaction_session_timeout='5000ms';
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $guard$ begin
  if not pg_try_advisory_xact_lock(hashtextextended('momi_cron_history.cleanup_writer.v1',0))
    then raise exception 'retention writer active'; end if;
  if exists(select 1 from pg_stat_progress_vacuum)
    or exists(select 1 from pg_locks where not granted)
    or exists(select 1 from pg_stat_activity where datname=current_database()
      and pid<>pg_backend_pid() and xact_start<clock_timestamp()-interval '30 seconds')
    then raise exception 'retention health preflight refused'; end if;
end $guard$;
create temporary table retention_before on commit drop as ${snapshot};
do $guard$ declare s record; phase text; begin
  select * into strict s from retention_before;
  if s.ledger_sha256<>'${approval.before.ledger_sha256}'
    or s.objects_sha256<>'${approval.before.objects_sha256}'
    or clock_timestamp()>=timestamptz '${approval.expires_at}'
    then raise exception 'retention approval snapshot expired or changed'; end if;
  if exists(select 1 from jsonb_each(s.objects->'dependencies') d where d.value<>'true')
    or s.objects->'metrics_routine'<>'true' or s.objects->'http_routine'<>'true'
    or jsonb_array_length(s.objects->'vault_names')<>2
    then raise exception 'retention dependencies absent'; end if;
  if to_regnamespace('momi_cron_history') is not null then
    execute 'select phase from momi_cron_history.policy_control where singleton' into strict phase;
    if phase<>'disarmed' then raise exception 'retention must remain disarmed'; end if;
  end if;
end $guard$;
${additions}
create temporary table retention_after on commit drop as ${snapshot};
do $guard$ declare b jsonb; a jsonb; begin
  select ledger into b from retention_before;
  select ledger into a from retention_after;
  if jsonb_array_length(a)<>jsonb_array_length(b)+${sources.length}
    or exists(select 1 from jsonb_array_elements(b) old where not a @> jsonb_build_array(old))
    then raise exception 'retention changed pre-existing migration history'; end if;
  if not exists(select 1 from momi_cron_history.policy_control where singleton and phase='disarmed')
    then raise exception 'retention unexpectedly armed'; end if;
end $guard$;
select jsonb_build_object('before',(select to_jsonb(b) from retention_before b),
  'after',(select to_jsonb(a) from retention_after a),'phase','disarmed') as receipt;
commit;`
}
