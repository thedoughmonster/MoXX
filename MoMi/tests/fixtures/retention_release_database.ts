import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

export async function retentionReleaseDatabase() {
  const database = new PGlite()
  await database.exec(await readFile(new URL("cron_history_governance.sql", import.meta.url), "utf8"))
  await database.exec(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(
      version text primary key, name text, statements text[], created_by text default current_user);
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values ('20261014090216','existing_external_capability',array['select 1']);
    create table vault.secrets(name text);
    insert into vault.secrets values ('momi_project_url'),('momi_publishable_key');
    create schema pgmq;
    create table pgmq.q_order_alerting_v1(id integer);
    create table pgmq.q_order_alerting_v1_dead_letter(id integer);
    create table pgmq.q_warehouse_projection_toast_v1(id integer);
    create table pgmq.q_warehouse_projection_toast_v1_dead_letter(id integer);
    create function pgmq.metrics(text) returns bigint language sql as 'select 0::bigint';
    insert into cron.job_run_details(runid,jobid,status,start_time,end_time)
      values(1,1,'succeeded','2020-01-01','2020-01-01');`)
  return database
}
