-- service-owner: toast-data-acquisition

create function toast_acquisition.wake_acquisition_worker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare route_path text; project_url text; gateway_key text;
begin
  if new.next_attempt_at > now() then return new; end if;
  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'toast.data.acquisition.http.v1'
    and registry.function_key = 'toast.data.acquisition.v1'
    and registry.route_path = '/functions/v1/toast-data-acquisition-v1'
    and registry.http_method = 'POST' and registry.active;
  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'job_id', new.job_id::text,
      'capability_token', new.capability_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger wake_acquisition_worker
after insert or update of status, capability_token
on toast_acquisition.jobs
for each row
when (new.status in ('pending', 'retry_wait'))
execute function toast_acquisition.wake_acquisition_worker();

select cron.schedule(
  'momi-toast-acquisition-wakeup-v1',
  '* * * * *',
  $$
    update toast_acquisition.jobs
    set capability_token = gen_random_uuid(),
        status = case
          when attempt_count >= 12 then 'dead_letter'
          else 'retry_wait'
        end,
        next_attempt_at = now(),
        lease_expires_at = null,
        last_error = case
          when status = 'running' then coalesce(last_error, 'worker lease expired')
          else last_error
        end
    where job_id in (
      select job_id from toast_acquisition.jobs
      where (
        status in ('pending', 'retry_wait') and next_attempt_at <= now()
      ) or (
        status = 'running' and lease_expires_at <= now()
      )
      order by next_attempt_at limit 100 for update skip locked
    )
  $$
);
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'momi-toast-acquisition-wakeup-v1';

revoke all on function toast_acquisition.wake_acquisition_worker()
  from public, anon, authenticated;
