-- service-owner: communications-archive

update momi_runtime.function_registry
set active = true
where function_key = 'momi.communications.evaluate_item.v1'
  and contract_version = 1
  and function_type = 'coordinator'
  and owner_service = 'communications-archive';

update momi_runtime.function_trigger_registry
set active = true
where trigger_key = 'momi.communications.evaluate_item.http.v1'
  and function_key = 'momi.communications.evaluate_item.v1'
  and contract_version = 1
  and trigger_type = 'http'
  and http_method = 'POST'
  and route_path = '/functions/v1/momi-communications-evaluate-item-v1'
  and schedule_policy_key = 'momi.communications.evaluator.schedule.v1'
  and authentication_policy_key = 'durable.work_token.v1'
  and owner_service = 'communications-archive';

select cron.alter_job(job_id := jobid, active := false)
from cron.job
where jobname = 'momi-communications-evaluator-wakeup-v1';

do $$
begin
  if (select count(*) from momi_runtime.function_registry
    where function_key = 'momi.communications.evaluate_item.v1'
      and owner_service = 'communications-archive' and active) <> 1
  then raise exception 'Communications evaluator function did not activate'; end if;

  if (select count(*) from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.communications.evaluate_item.http.v1'
      and function_key = 'momi.communications.evaluate_item.v1'
      and owner_service = 'communications-archive' and active) <> 1
  then raise exception 'Communications evaluator route did not activate'; end if;

  if (select count(*) from cron.job
    where jobname = 'momi-communications-evaluator-wakeup-v1'
      and not active and schedule = '30 seconds') <> 1
  then raise exception 'Communications evaluator schedule activated early'; end if;
end;
$$;
