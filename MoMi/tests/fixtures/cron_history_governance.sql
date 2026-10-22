create role anon;
create role authenticated;
create role service_role;

create schema cron;
create table cron.job (
  jobid bigint generated always as identity primary key,
  jobname text not null unique,
  schedule text not null,
  command text not null,
  active boolean not null default true
);
create table cron.job_run_details (
  runid bigint primary key,
  jobid bigint not null,
  job_pid integer,
  database text default 'postgres',
  username text default 'postgres',
  command text default 'select fixture_only()',
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);
create function cron.schedule(p_name text, p_schedule text, p_command text)
returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command)
  values (p_name, p_schedule, p_command)
  returning jobid;
$$;

create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
create schema net;
create function net.http_post(
  url text, body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 1000
) returns bigint language plpgsql as $$
begin
  raise exception 'network dispatch is forbidden in the local fixture';
end;
$$;
