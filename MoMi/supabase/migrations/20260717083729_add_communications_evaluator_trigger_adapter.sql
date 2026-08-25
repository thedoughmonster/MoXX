-- service-owner: communications-archive

create function momi_communications.wake_communications_evaluator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path text;
  project_url text;
  gateway_key text;
begin
  if new.job_status not in ('pending', 'failed')
    or new.next_attempt_at > now()
  then return new;
  end if;

  select registry.route_path into route_path
  from momi_runtime.function_trigger_registry as registry
  where registry.trigger_key = 'momi.communications.evaluate_item.http.v1'
    and registry.function_key = 'momi.communications.evaluate_item.v1'
    and registry.route_path = '/functions/v1/momi-communications-evaluate-item-v1'
    and registry.http_method = 'POST'
    and registry.active;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'evaluation_job_id', new.evaluation_job_id::text,
      'capability_token', new.capability_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

create trigger dispatch_communications_evaluator
after update of capability_token on momi_communications.evaluation_jobs
for each row execute function momi_communications.wake_communications_evaluator();

select cron.schedule(
  'momi-communications-evaluator-wakeup-v1',
  '30 seconds',
  $command$
    update momi_communications.evaluation_jobs as job
    set capability_token = gen_random_uuid(),
        job_status = case
          when job.attempt_count >= 5 then 'dead_letter'
          when job.job_status = 'claimed' then 'failed'
          else job.job_status
        end,
        next_attempt_at = now(),
        lease_expires_at = null,
        last_error_code = case
          when job.job_status = 'claimed'
            then coalesce(job.last_error_code, 'lease_expired')
          else job.last_error_code
        end,
        last_error_message = case
          when job.job_status = 'claimed'
            then coalesce(job.last_error_message, 'evaluator lease expired')
          else job.last_error_message
        end
    where job.evaluation_job_id in (
      select due.evaluation_job_id
      from momi_communications.evaluation_jobs as due
      where (
        due.job_status in ('pending', 'failed')
        and due.next_attempt_at <= now()
      ) or (
        due.job_status = 'claimed'
        and due.lease_expires_at <= now()
      )
      order by coalesce(due.lease_expires_at, due.next_attempt_at),
        due.evaluation_job_id
      limit 4 for update skip locked
    )
  $command$
);

select cron.alter_job(job_id := jobid, active := false)
from cron.job
where jobname = 'momi-communications-evaluator-wakeup-v1';

do $$
begin
  if (select count(*) from cron.job
    where jobname = 'momi-communications-evaluator-wakeup-v1'
      and not active and schedule = '30 seconds') <> 1
  then raise exception 'Communications evaluator schedule is invalid'; end if;
end;
$$;

revoke all on function momi_communications.wake_communications_evaluator()
  from public, anon, authenticated;
